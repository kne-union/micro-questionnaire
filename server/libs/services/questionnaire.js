const fp = require('fastify-plugin');
const path = require('path');
const pick = require('lodash/pick');
const isEqual = require('lodash/isEqual');
const dayjs = require('dayjs');
const XLSX = require('xlsx');
const { buildQuestionnaireColumns } = require('../utils/questionnaire-excel');
const { generateQuestionnaireSchema } = require('../utils/questionnaire-ai-generator');
const { generatePosterHtml, generateAppearanceHtml } = require('../utils/poster-ai-generator');
const { DEFAULT_TEMPLATES, pickText, localizeBuiltinTemplate, matchBuiltinKeys } = require('../utils/default-templates');

const TOKEN_TYPE = 'questionnaire-project';
const INVITE_TOKEN_TYPE = 'questionnaire-invite';
const WEBHOOK_TIMEOUT = 15000;
const SYSTEM_USER_ID = '';
const PROJECT_LANGUAGES = ['zh-CN', 'en-US', 'both'];
const TEMPLATE_LANGUAGES = ['zh-CN', 'en-US'];

const decodeProjectText = value => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (error) {
        // keep plain string
      }
    }
    return value;
  }
  return value == null ? '' : String(value);
};

const encodeProjectText = (value, language, { required = false, label = '内容' } = {}) => {
  if (language === 'both') {
    const source = value && typeof value === 'object' ? value : {};
    const zh = String(source['zh-CN'] || '').trim();
    const en = String(source['en-US'] || '').trim();
    if (required && !zh) {
      throw new Error(`请填写中文${label}`);
    }
    if (required && !en) {
      throw new Error(`请填写英文${label}`);
    }
    if (!zh && !en) {
      return '';
    }
    if (!zh || !en) {
      throw new Error(`${label}需同时填写中文和英文`);
    }
    return JSON.stringify({ 'zh-CN': zh, 'en-US': en });
  }
  const text = value && typeof value === 'object' ? pickText(value, language) : String(value || '').trim();
  if (required && !text) {
    throw new Error(`请填写${label}`);
  }
  return text;
};

const projectLanguageAllowed = (templateLanguages, language) => {
  const langs = normalizeTemplateLanguages(templateLanguages);
  if (language === 'both') {
    return langs.includes('zh-CN') && langs.includes('en-US');
  }
  return langs.includes(language);
};
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_BANNERS = 5;
const MAX_POSTERS = 20;

const isFileId = value => /^\d{1,32}$/.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizeImage = item => {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const id = String(item.id || item.ossId || '').trim();
  if (!isFileId(id)) {
    return null;
  }
  const filename = String(item.originalName || item.filename || '').trim().slice(0, 200);
  const ext = path.extname(filename).toLowerCase();
  if (filename && !IMAGE_EXT.has(ext)) {
    return null;
  }
  return { id, filename };
};

const normalizeImages = (value, max) => {
  const list = Array.isArray(value) ? value : [];
  const images = [];
  list.forEach(item => {
    if (images.length >= max) {
      return;
    }
    const image = normalizeImage(item);
    if (image) {
      images.push(image);
    }
  });
  return images;
};

const hasSchemaBlocks = schema => Array.isArray(schema?.blocks) && schema.blocks.some(block => (block?.list || []).some(field => field && field.name));

const normalizeThemeColor = value => {
  const text = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text) || /^#[0-9a-fA-F]{8}$/.test(text)) {
    return text.slice(0, 7);
  }
  return null;
};

const normalizeTemplateLanguages = value => {
  const list = Array.isArray(value) ? value : [];
  const result = TEMPLATE_LANGUAGES.filter(item => list.includes(item));
  return result.length ? result : [TEMPLATE_LANGUAGES[0]];
};

const plain = row => (row?.get ? row.get({ plain: true }) : row);

const formatTemplate = row => {
  const data = plain(row);
  return {
    id: String(data.id),
    name: data.name,
    description: data.description || '',
    builtinKey: data.builtinKey || '',
    languages: normalizeTemplateLanguages(data.languages),
    schema: data.schema || {},
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
};

const formatProject = (row, extra = {}) => {
  const data = plain(row);
  return {
    id: String(data.id),
    templateId: data.templateId == null ? null : String(data.templateId),
    name: decodeProjectText(data.name),
    description: decodeProjectText(data.description),
    schema: data.schema || {},
    status: data.status,
    language: PROJECT_LANGUAGES.includes(data.language) ? data.language : 'both',
    background: normalizeImage(data.background),
    banners: normalizeImages(data.banners, MAX_BANNERS),
    themeColor: normalizeThemeColor(data.themeColor),
    posterBackground: normalizeImage(data.posterBackground),
    code: data.code || '',
    path: data.code ? `/q/${data.code}` : '',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...extra
  };
};

const formatPoster = row => {
  const data = plain(row);
  return {
    id: String(data.id),
    html: data.html || '',
    width: data.width,
    height: data.height,
    requirement: data.requirement || '',
    createdAt: data.createdAt
  };
};

const formatResponse = row => {
  const data = plain(row);
  return {
    id: String(data.id),
    projectId: String(data.projectId),
    answers: data.answers || {},
    submittedAt: data.submittedAt
  };
};

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const ensureProjectLanguage = async () => {
    const model = models.questionnaireProject;
    const table = model.getTableName();
    const tableName = typeof table === 'object' ? table.tableName : table;
    const schema = typeof table === 'object' ? table.schema : undefined;
    const queryInterface = model.sequelize.getQueryInterface();
    const desc = await queryInterface.describeTable(tableName, schema ? { schema } : undefined);
    const columnOptions = schema ? { schema } : undefined;
    if (!desc.language) {
      await queryInterface.addColumn(
        tableName,
        'language',
        {
          type: fastify.sequelize.Sequelize.DataTypes.STRING,
          allowNull: true,
          defaultValue: 'both'
        },
        columnOptions
      );
    }
    if (!desc.background) {
      await queryInterface.addColumn(tableName, 'background', { type: fastify.sequelize.Sequelize.DataTypes.JSON, allowNull: true }, columnOptions);
    }
    if (!desc.banners) {
      await queryInterface.addColumn(tableName, 'banners', { type: fastify.sequelize.Sequelize.DataTypes.JSON, allowNull: true }, columnOptions);
    }
    if (!desc.theme_color && !desc.themeColor) {
      await queryInterface.addColumn(tableName, 'theme_color', { type: fastify.sequelize.Sequelize.DataTypes.STRING, allowNull: true }, columnOptions);
    }
    if (!desc.poster_background && !desc.posterBackground) {
      await queryInterface.addColumn(tableName, 'poster_background', { type: fastify.sequelize.Sequelize.DataTypes.JSON, allowNull: true }, columnOptions);
    }
    await model.update({ language: 'both' }, { where: { [Op.or]: [{ language: null }, { language: '' }] } });
  };

  await ensureProjectLanguage();

  const ensureTemplateLanguages = async () => {
    const model = models.questionnaireTemplate;
    const table = model.getTableName();
    const tableName = typeof table === 'object' ? table.tableName : table;
    const schema = typeof table === 'object' ? table.schema : undefined;
    const queryInterface = model.sequelize.getQueryInterface();
    const desc = await queryInterface.describeTable(tableName, schema ? { schema } : undefined);
    if (!desc.languages) {
      await queryInterface.addColumn(tableName, 'languages', { type: fastify.sequelize.Sequelize.DataTypes.JSON, allowNull: true }, schema ? { schema } : undefined);
    }
  };

  await ensureTemplateLanguages();

  const ownerWhere = userInfo => ({ userId: userInfo.id });

  const syncDefaultTemplates = async () => {
    fastify.log.info('------start include questionnaire template------');
    for (const item of DEFAULT_TEMPLATES) {
      const row = await models.questionnaireTemplate.findOne({
        where: { builtinKey: item.key, userId: SYSTEM_USER_ID }
      });
      const name = pickText(item.name, 'zh-CN');
      const description = pickText(item.description, 'zh-CN');
      if (row) {
        if (row.name !== name || row.description !== description || !isEqual(row.languages, TEMPLATE_LANGUAGES) || !isEqual(row.schema, item.schema)) {
          await row.update({ name, description, languages: TEMPLATE_LANGUAGES, schema: item.schema });
          fastify.log.info(`update template: ${item.key}`);
        }
        continue;
      }
      await models.questionnaireTemplate.create({
        userId: SYSTEM_USER_ID,
        builtinKey: item.key,
        name,
        description,
        languages: TEMPLATE_LANGUAGES,
        schema: item.schema
      });
      fastify.log.info(`create template: ${item.key}`);
    }
    await models.questionnaireTemplate.destroy({
      where: {
        builtinKey: { [Op.ne]: null },
        userId: { [Op.ne]: SYSTEM_USER_ID }
      }
    });
    fastify.log.info('------end include questionnaire template------');
  };

  const requireOwnedTemplate = async (userInfo, id) => {
    const row = await models.questionnaireTemplate.findOne({ where: Object.assign({ id }, ownerWhere(userInfo)) });
    if (!row) {
      throw new Error('问卷模版不存在');
    }
    return row;
  };

  const requireOwnedProject = async (userInfo, id) => {
    const row = await models.questionnaireProject.findOne({ where: Object.assign({ id }, ownerWhere(userInfo)) });
    if (!row) {
      throw new Error('问卷项目不存在');
    }
    return row;
  };

  const getTemplateList = async (userInfo, { filter = {}, perPage = 20, currentPage = 1, locale } = {}) => {
    const scope = {
      [Op.or]: [{ userId: userInfo.id }, { userId: SYSTEM_USER_ID }]
    };
    const conditions = [scope];
    if (filter.keyword) {
      const nameLike = { name: { [Op.like]: `%${String(filter.keyword).trim()}%` } };
      const builtinKeys = matchBuiltinKeys(filter.keyword);
      conditions.push(builtinKeys.length ? { [Op.or]: [nameLike, { builtinKey: builtinKeys, userId: SYSTEM_USER_ID }] } : nameLike);
    }
    if (filter.kind === 'builtin') {
      conditions.push({ builtinKey: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } });
    }
    if (filter.kind === 'custom') {
      conditions.push({ [Op.or]: [{ builtinKey: null }, { builtinKey: '' }] });
    }
    const where = conditions.length === 1 ? scope : { [Op.and]: conditions };
    const { count, rows } = await models.questionnaireTemplate.findAndCountAll({
      where,
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [['updatedAt', 'DESC']]
    });
    return { pageData: rows.map(row => localizeBuiltinTemplate(formatTemplate(row), locale)), totalCount: count };
  };

  const getTemplateDetail = async (userInfo, { id, locale }) => localizeBuiltinTemplate(formatTemplate(await requireOwnedTemplate(userInfo, id)), locale);

  const saveTemplate = async (userInfo, { id, name, description, schema, languages }) => {
    if (id) {
      const row = await models.questionnaireTemplate.findOne({
        where: { id, [Op.or]: [{ userId: userInfo.id }, { userId: SYSTEM_USER_ID }] }
      });
      if (!row) {
        throw new Error('问卷模版不存在');
      }
      if (name !== undefined) {
        if (!String(name || '').trim()) {
          throw new Error('请填写模版名称');
        }
        row.name = String(name).trim();
      }
      if (description !== undefined) {
        row.description = description || '';
      }
      if (languages !== undefined) {
        row.languages = normalizeTemplateLanguages(languages);
      }
      if (schema !== undefined) {
        if (!hasSchemaBlocks(schema)) {
          throw new Error('请添加问卷题目');
        }
        row.schema = schema;
      }
      await row.save();
      return formatTemplate(row);
    }
    if (!String(name || '').trim()) {
      throw new Error('请填写模版名称');
    }
    if (!hasSchemaBlocks(schema)) {
      throw new Error('请添加问卷题目');
    }
    const row = await models.questionnaireTemplate.create({
      userId: userInfo.id,
      name: String(name).trim(),
      description: description || '',
      languages: normalizeTemplateLanguages(languages),
      schema
    });
    return formatTemplate(row);
  };

  const removeTemplate = async (userInfo, { id }) => {
    const row = await requireOwnedTemplate(userInfo, id);
    await row.destroy();
    return {};
  };

  const generateSchema = async body => generateQuestionnaireSchema(fastify, body);

  const signProjectCode = async projectId => {
    const shorten = fastify.shorten?.services;
    if (!shorten?.sign) {
      throw new Error('短链服务未就绪');
    }
    return shorten.sign(JSON.stringify({ type: TOKEN_TYPE, projectId: String(projectId) }));
  };

  const createProject = async (userInfo, { templateId, name, description, language, background, banners, themeColor, copyFromId }) => {
    const template = await models.questionnaireTemplate.findOne({
      where: {
        id: templateId,
        [Op.or]: [{ userId: userInfo.id }, { userId: SYSTEM_USER_ID }]
      }
    });
    if (!template) {
      throw new Error('问卷模版不存在');
    }
    const templateLanguages = normalizeTemplateLanguages(template.languages);
    let schema = template.schema;
    if (copyFromId) {
      const source = await models.questionnaireProject.findOne({ where: Object.assign({ id: copyFromId }, ownerWhere(userInfo)) });
      if (source && String(source.templateId) === String(template.id) && hasSchemaBlocks(source.schema)) {
        schema = source.schema;
      }
    }
    if (!hasSchemaBlocks(schema)) {
      throw new Error('模版还没有题目');
    }
    const fillLanguage = language == null || language === '' ? (templateLanguages.length > 1 ? 'both' : templateLanguages[0]) : language;
    if (!PROJECT_LANGUAGES.includes(fillLanguage) || !projectLanguageAllowed(templateLanguages, fillLanguage)) {
      throw new Error('填写语言不正确');
    }
    const title = encodeProjectText(name == null || name === '' ? template.name : name, fillLanguage, { required: true, label: '项目名称' });
    const detail = encodeProjectText(description == null ? template.description || '' : description, fillLanguage, { required: false, label: '项目说明' });
    const row = await models.questionnaireProject.create({
      userId: userInfo.id,
      templateId: template.id,
      name: title,
      description: detail,
      schema: JSON.parse(JSON.stringify(schema || {})),
      status: 'open',
      language: fillLanguage,
      background: normalizeImages(background, 1)[0] || null,
      banners: normalizeImages(banners, MAX_BANNERS),
      themeColor: normalizeThemeColor(themeColor)
    });
    row.code = await signProjectCode(row.id);
    await row.save();
    return formatProject(row, { templateLanguages });
  };

  const getProjectList = async (userInfo, { filter = {}, perPage = 20, currentPage = 1, locale } = {}) => {
    const where = ownerWhere(userInfo);
    if (filter.keyword) {
      where.name = { [Op.like]: `%${String(filter.keyword).trim()}%` };
    }
    const templateId = filter.templateId && typeof filter.templateId === 'object' ? filter.templateId.id || filter.templateId.value : filter.templateId;
    if (templateId) {
      where.templateId = String(templateId);
    }
    if (filter.status === 'open' || filter.status === 'closed') {
      where.status = filter.status;
    }
    const range = Array.isArray(filter.updatedAt) ? filter.updatedAt : filter.updatedAt && typeof filter.updatedAt === 'object' ? [filter.updatedAt[0], filter.updatedAt[1]] : null;
    if (range && range[0] && range[1]) {
      const start = new Date(range[0]);
      const end = new Date(range[1]);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        where.updatedAt = { [Op.gte]: start, [Op.lte]: end };
      }
    }
    const { count, rows } = await models.questionnaireProject.findAndCountAll({
      where,
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [['updatedAt', 'DESC']]
    });
    const ids = rows.map(row => row.id);
    const templateIds = [...new Set(rows.map(row => row.templateId).filter(Boolean).map(id => String(id)))];
    const nameByTemplate = {};
    const languagesByTemplate = {};
    if (templateIds.length) {
      const templates = await models.questionnaireTemplate.findAll({
        where: { id: templateIds },
        attributes: ['id', 'name', 'builtinKey', 'languages']
      });
      templates.forEach(item => {
        nameByTemplate[String(item.id)] = localizeBuiltinTemplate({ name: item.name, builtinKey: item.builtinKey }, locale).name;
        languagesByTemplate[String(item.id)] = normalizeTemplateLanguages(item.languages);
      });
    }
    const countByProject = {};
    if (ids.length) {
      const sequelize = models.questionnaireResponse.sequelize;
      const counts = await models.questionnaireResponse.findAll({
        attributes: ['projectId', [sequelize.fn('COUNT', sequelize.col('id')), 'responseCount']],
        where: { projectId: ids },
        group: ['projectId'],
        raw: true
      });
      counts.forEach(item => {
        countByProject[String(item.projectId)] = Number(item.responseCount) || 0;
      });
    }
    return {
      pageData: rows.map(row =>
        Object.assign(formatProject(row, { templateLanguages: languagesByTemplate[String(row.templateId)] || ['zh-CN'] }), {
          responseCount: countByProject[String(row.id)] || 0,
          templateName: nameByTemplate[String(row.templateId)] || ''
        })
      ),
      totalCount: count
    };
  };

  const getProjectDetail = async (userInfo, { id }) => {
    const row = await requireOwnedProject(userInfo, id);
    let templateLanguages = ['zh-CN'];
    if (row.templateId) {
      const template = await models.questionnaireTemplate.findByPk(row.templateId, { attributes: ['languages'] });
      templateLanguages = normalizeTemplateLanguages(template?.languages);
    }
    const data = formatProject(row, { templateLanguages });
    const background = await withPublicFile(data.background);
    const banners = (await Promise.all((data.banners || []).map(withPublicFile))).filter(item => item && item.url);
    const posterBackground = await withPublicFile(data.posterBackground);
    return Object.assign({}, data, { background, banners, posterBackground });
  };

  const generatePoster = async (userInfo, { id, width, height, requirement, locale }) => {
    const data = formatProject(await requireOwnedProject(userInfo, id));
    const posterLocale = locale === 'en-US' ? 'en-US' : 'zh-CN';
    const { html } = await generatePosterHtml(fastify, {
      name: pickText(data.name, posterLocale),
      description: pickText(data.description, posterLocale),
      width,
      height,
      requirement,
      hasBackground: !!data.background,
      locale
    });
    const row = await models.questionnairePoster.create({
      userId: userInfo.id,
      projectId: data.id,
      html,
      width: Math.round(width),
      height: Math.round(height),
      requirement: String(requirement || '').trim()
    });
    const overflow = await models.questionnairePoster.findAll({
      where: { projectId: data.id },
      attributes: ['id'],
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ],
      offset: MAX_POSTERS
    });
    if (overflow.length) {
      await models.questionnairePoster.destroy({ where: { id: overflow.map(item => item.id) } });
    }
    return formatPoster(row);
  };

  const getPosterList = async (userInfo, { id }) => {
    const project = await requireOwnedProject(userInfo, id);
    const rows = await models.questionnairePoster.findAll({
      where: { projectId: String(project.id) },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ],
      limit: MAX_POSTERS
    });
    return rows.map(formatPoster);
  };

  const removePoster = async (userInfo, { id }) => {
    const row = await models.questionnairePoster.findOne({ where: Object.assign({ id }, ownerWhere(userInfo)) });
    if (!row) {
      throw new Error('海报不存在');
    }
    await row.destroy();
    return {};
  };

  const savePosterBackground = async (userInfo, { id, background }) => {
    const row = await requireOwnedProject(userInfo, id);
    row.posterBackground = normalizeImages(background, 1)[0] || null;
    await row.save();
    return { posterBackground: await withPublicFile(formatProject(row).posterBackground) };
  };

  const generateAppearanceImage = async (userInfo, { id, kind, requirement, locale }) => {
    const data = formatProject(await requireOwnedProject(userInfo, id));
    const imageLocale = locale === 'en-US' ? 'en-US' : 'zh-CN';
    return generateAppearanceHtml(fastify, {
      kind,
      name: pickText(data.name, imageLocale),
      description: pickText(data.description, imageLocale),
      themeColor: data.themeColor,
      requirement,
      locale
    });
  };

  const updateAppearance = async (userInfo, { id, background, banners, themeColor }) => {
    const row = await requireOwnedProject(userInfo, id);
    row.background = normalizeImages(background, 1)[0] || null;
    row.banners = normalizeImages(banners, MAX_BANNERS);
    if (themeColor !== undefined) {
      row.themeColor = normalizeThemeColor(themeColor);
    }
    await row.save();
    return formatProject(row);
  };

  const closeProject = async (userInfo, { id }) => {
    const row = await requireOwnedProject(userInfo, id);
    row.status = 'closed';
    await row.save();
    return formatProject(row);
  };

  const openProject = async (userInfo, { id }) => {
    const row = await requireOwnedProject(userInfo, id);
    row.status = 'open';
    await row.save();
    return formatProject(row);
  };

  const getResponseList = async (userInfo, { id, perPage = 20, currentPage = 1 }) => {
    await requireOwnedProject(userInfo, id);
    const { count, rows } = await models.questionnaireResponse.findAndCountAll({
      where: { projectId: id },
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [['submittedAt', 'DESC']]
    });
    return { pageData: rows.map(formatResponse), totalCount: count };
  };

  const exportProject = async (userInfo, { id, locale }) => {
    const project = await requireOwnedProject(userInfo, id);
    const rows = await models.questionnaireResponse.findAll({
      where: { projectId: project.id },
      order: [['submittedAt', 'ASC']]
    });
    if (!rows.length) {
      throw new Error('暂无答卷可下载');
    }
    const isEnglish = String(locale || '').startsWith('en');
    const columns = buildQuestionnaireColumns(project.schema, locale);
    const matrix = [[isEnglish ? 'Submitted At' : '提交时间', ...columns.map(column => column.header)]];
    rows.forEach(row => {
      const item = formatResponse(row);
      matrix.push([dayjs(item.submittedAt).format('YYYY-MM-DD HH:mm:ss'), ...columns.map(column => column.getValue(item.answers))]);
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(matrix), isEnglish ? 'Results' : '问卷结果');
    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      file: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    };
  };

  const formatInvite = row => {
    const data = plain(row);
    return {
      id: String(data.id),
      projectId: String(data.projectId),
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      externalId: data.externalId || '',
      expiresAt: data.expiresAt || null,
      code: data.code || '',
      path: data.code ? `/q/${data.code}` : '',
      status: data.status,
      submittedAt: data.submittedAt || null,
      webhookStatus: data.webhookStatus || null,
      createdAt: data.createdAt
    };
  };

  /** 为指定填写人生成独立短码；提交后带答卷回调 webhook */
  const createInvite = async (userInfo, { projectId, name, email, phone, externalId, webhook, expiresAt }) => {
    const project = await requireOwnedProject(userInfo, projectId);
    if (project.status !== 'open') {
      throw new Error('问卷已关闭');
    }
    if (webhook && !/^https?:\/\//i.test(String(webhook))) {
      throw new Error('webhook 须为 http(s) 地址');
    }
    const expires = expiresAt ? new Date(expiresAt) : null;
    if (expires && (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now())) {
      throw new Error('过期时间不正确');
    }
    const shorten = fastify.shorten?.services;
    if (!shorten?.sign) {
      throw new Error('短链服务未就绪');
    }
    const row = await models.questionnaireInvite.create({
      userId: userInfo.id,
      projectId: String(project.id),
      name: String(name || '').trim(),
      email: String(email || '').trim(),
      phone: String(phone || '').trim(),
      externalId: externalId == null ? null : String(externalId),
      webhook: webhook || null,
      expiresAt: expires
    });
    row.code = await shorten.sign(JSON.stringify({ type: INVITE_TOKEN_TYPE, inviteId: String(row.id) }), expires ? expires.getTime() : undefined);
    await row.save();
    return formatInvite(row);
  };

  const getInviteDetail = async (userInfo, { id }) => {
    const row = await models.questionnaireInvite.findOne({ where: Object.assign({ id }, ownerWhere(userInfo)) });
    if (!row) {
      throw new Error('邀请不存在');
    }
    return formatInvite(row);
  };

  /** 解析填写短码：项目码返回 { project }，邀请码返回 { project, invite } */
  const resolveCode = async code => {
    const shorten = fastify.shorten?.services;
    if (!shorten?.decode) {
      throw new Error('短链服务未就绪');
    }
    let payload;
    try {
      payload = JSON.parse(await shorten.decode(String(code || '')));
    } catch (error) {
      throw new Error('问卷链接无效');
    }
    if (payload?.type === INVITE_TOKEN_TYPE && payload.inviteId) {
      const invite = await models.questionnaireInvite.findByPk(payload.inviteId);
      if (!invite) {
        throw new Error('问卷链接无效');
      }
      if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
        throw new Error('问卷链接已过期');
      }
      const project = await models.questionnaireProject.findByPk(invite.projectId);
      if (!project) {
        throw new Error('问卷不存在');
      }
      return { project, invite };
    }
    if (!payload || payload.type !== TOKEN_TYPE || !payload.projectId) {
      throw new Error('问卷链接无效');
    }
    const project = await models.questionnaireProject.findByPk(payload.projectId);
    if (!project) {
      throw new Error('问卷不存在');
    }
    return { project, invite: null };
  };

  const notifyWebhook = async ({ invite, project, response }) => {
    if (!invite.webhook) {
      return;
    }
    try {
      const res = await fetch(invite.webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'questionnaire.submitted',
          invite: formatInvite(invite),
          project: pick(formatProject(project), ['id', 'name', 'description', 'schema', 'language']),
          response: formatResponse(response)
        }),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT)
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      }
      invite.webhookStatus = 'succeeded';
      invite.webhookError = null;
    } catch (error) {
      fastify.log.error({ err: error, inviteId: String(invite.id) }, 'questionnaire webhook failed');
      invite.webhookStatus = 'failed';
      invite.webhookError = String(error?.message || error).slice(0, 1000);
    }
    await invite.save();
  };

  const withPublicFile = async image => {
    if (!image) {
      return null;
    }
    const getFileUrl = fastify.fileManager?.services?.getFileUrl;
    if (typeof getFileUrl !== 'function') {
      return image;
    }
    try {
      const url = await getFileUrl({ id: image.id });
      return Object.assign({}, image, { url: typeof url === 'string' ? url : '' });
    } catch (error) {
      return null;
    }
  };

  const getPublicDetail = async ({ code }) => {
    const { project: row, invite } = await resolveCode(code);
    const data = formatProject(row);
    const background = await withPublicFile(data.background);
    const banners = (await Promise.all((data.banners || []).map(withPublicFile))).filter(item => item && item.url);
    return Object.assign(pick(data, ['name', 'description', 'schema', 'status', 'language', 'themeColor']), {
      background,
      banners,
      submitted: invite?.status === 'submitted'
    });
  };

  const submitPublic = async ({ code, answers }) => {
    const { project: row, invite } = await resolveCode(code);
    if (row.status !== 'open') {
      throw new Error('问卷已关闭');
    }
    if (invite?.status === 'submitted') {
      throw new Error('问卷已提交，无需重复填写');
    }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new Error('答卷格式不正确');
    }
    const response = await models.questionnaireResponse.create({
      projectId: row.id,
      answers,
      submittedAt: new Date()
    });
    if (invite) {
      invite.status = 'submitted';
      invite.responseId = String(response.id);
      invite.submittedAt = response.submittedAt;
      await invite.save();
      await notifyWebhook({ invite, project: row, response });
    }
    return {};
  };

  fastify[options.name].services.questionnaire = {
    getTemplateList,
    getTemplateDetail,
    saveTemplate,
    removeTemplate,
    generateSchema,
    createProject,
    updateAppearance,
    getProjectList,
    getProjectDetail,
    generatePoster,
    getPosterList,
    removePoster,
    savePosterBackground,
    generateAppearanceImage,
    closeProject,
    openProject,
    getResponseList,
    exportProject,
    createInvite,
    getInviteDetail,
    getPublicDetail,
    submitPublic
  };

  fastify.sequelize.syncPromise.then(() => syncDefaultTemplates()).catch(err => {
    fastify.log.error(err);
  });
});
