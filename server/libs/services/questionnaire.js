const fp = require('fastify-plugin');
const path = require('path');
const pick = require('lodash/pick');
const dayjs = require('dayjs');
const XLSX = require('xlsx');
const { buildQuestionnaireColumns } = require('../utils/questionnaire-excel');
const { generateQuestionnaireSchema } = require('../utils/questionnaire-ai-generator');
const { DEFAULT_TEMPLATES } = require('../utils/default-templates');

const TOKEN_TYPE = 'questionnaire-project';
const SYSTEM_USER_ID = '';
const PROJECT_LANGUAGES = ['zh-CN', 'en-US', 'both'];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_BANNERS = 5;

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

const plain = row => (row?.get ? row.get({ plain: true }) : row);

const formatTemplate = row => {
  const data = plain(row);
  return {
    id: String(data.id),
    name: data.name,
    description: data.description || '',
    builtinKey: data.builtinKey || '',
    schema: data.schema || {},
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
};

const formatProject = row => {
  const data = plain(row);
  return {
    id: String(data.id),
    templateId: data.templateId == null ? null : String(data.templateId),
    name: data.name,
    description: data.description || '',
    schema: data.schema || {},
    status: data.status,
    language: PROJECT_LANGUAGES.includes(data.language) ? data.language : 'both',
    background: normalizeImage(data.background),
    banners: normalizeImages(data.banners, MAX_BANNERS),
    themeColor: normalizeThemeColor(data.themeColor),
    code: data.code || '',
    path: data.code ? `/q/${data.code}` : '',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
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
    await model.update({ language: 'both' }, { where: { [Op.or]: [{ language: null }, { language: '' }] } });
  };

  await ensureProjectLanguage();

  const ownerWhere = userInfo => ({ userId: userInfo.id });

  const syncDefaultTemplates = async () => {
    fastify.log.info('------start include questionnaire template------');
    for (const item of DEFAULT_TEMPLATES) {
      const row = await models.questionnaireTemplate.findOne({
        where: { builtinKey: item.key, userId: SYSTEM_USER_ID }
      });
      if (row) {
        continue;
      }
      await models.questionnaireTemplate.create({
        userId: SYSTEM_USER_ID,
        builtinKey: item.key,
        name: item.name,
        description: item.description,
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

  const getTemplateList = async (userInfo, { filter = {}, perPage = 20, currentPage = 1 } = {}) => {
    const scope = {
      [Op.or]: [{ userId: userInfo.id }, { userId: SYSTEM_USER_ID }]
    };
    const conditions = [scope];
    if (filter.keyword) {
      conditions.push({ name: { [Op.like]: `%${String(filter.keyword).trim()}%` } });
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
    return { pageData: rows.map(formatTemplate), totalCount: count };
  };

  const getTemplateDetail = async (userInfo, { id }) => formatTemplate(await requireOwnedTemplate(userInfo, id));

  const saveTemplate = async (userInfo, { id, name, description, schema }) => {
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
    const title = String(name || template.name || '').trim();
    if (!title) {
      throw new Error('请填写项目名称');
    }
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
    const fillLanguage = language == null || language === '' ? 'both' : language;
    if (!PROJECT_LANGUAGES.includes(fillLanguage)) {
      throw new Error('填写语言不正确');
    }
    const row = await models.questionnaireProject.create({
      userId: userInfo.id,
      templateId: template.id,
      name: title,
      description: description == null ? template.description || '' : description,
      schema: JSON.parse(JSON.stringify(schema || {})),
      status: 'open',
      language: fillLanguage,
      background: normalizeImages(background, 1)[0] || null,
      banners: normalizeImages(banners, MAX_BANNERS),
      themeColor: normalizeThemeColor(themeColor)
    });
    row.code = await signProjectCode(row.id);
    await row.save();
    return formatProject(row);
  };

  const getProjectList = async (userInfo, { filter = {}, perPage = 20, currentPage = 1 } = {}) => {
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
    if (templateIds.length) {
      const templates = await models.questionnaireTemplate.findAll({
        where: { id: templateIds },
        attributes: ['id', 'name']
      });
      templates.forEach(item => {
        nameByTemplate[String(item.id)] = item.name;
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
        Object.assign(formatProject(row), {
          responseCount: countByProject[String(row.id)] || 0,
          templateName: nameByTemplate[String(row.templateId)] || ''
        })
      ),
      totalCount: count
    };
  };

  const getProjectDetail = async (userInfo, { id }) => {
    const data = formatProject(await requireOwnedProject(userInfo, id));
    const background = await withPublicFile(data.background);
    const banners = (await Promise.all((data.banners || []).map(withPublicFile))).filter(item => item && item.url);
    return Object.assign({}, data, { background, banners });
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

  const exportProject = async (userInfo, { id }) => {
    const project = await requireOwnedProject(userInfo, id);
    const rows = await models.questionnaireResponse.findAll({
      where: { projectId: project.id },
      order: [['submittedAt', 'ASC']]
    });
    if (!rows.length) {
      throw new Error('暂无答卷可下载');
    }
    const columns = buildQuestionnaireColumns(project.schema);
    const matrix = [['提交时间', ...columns.map(column => column.header)]];
    rows.forEach(row => {
      const item = formatResponse(row);
      matrix.push([dayjs(item.submittedAt).format('YYYY-MM-DD HH:mm:ss'), ...columns.map(column => column.getValue(item.answers))]);
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(matrix), '问卷结果');
    return {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      file: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    };
  };

  const getProjectByCode = async code => {
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
    if (!payload || payload.type !== TOKEN_TYPE || !payload.projectId) {
      throw new Error('问卷链接无效');
    }
    const row = await models.questionnaireProject.findByPk(payload.projectId);
    if (!row) {
      throw new Error('问卷不存在');
    }
    return row;
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
    const row = await getProjectByCode(code);
    const data = formatProject(row);
    const background = await withPublicFile(data.background);
    const banners = (await Promise.all((data.banners || []).map(withPublicFile))).filter(item => item && item.url);
    return Object.assign(pick(data, ['name', 'description', 'schema', 'status', 'language', 'themeColor']), {
      background,
      banners
    });
  };

  const submitPublic = async ({ code, answers }) => {
    const row = await getProjectByCode(code);
    if (row.status !== 'open') {
      throw new Error('问卷已关闭');
    }
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new Error('答卷格式不正确');
    }
    await models.questionnaireResponse.create({
      projectId: row.id,
      answers,
      submittedAt: new Date()
    });
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
    closeProject,
    openProject,
    getResponseList,
    exportProject,
    getPublicDetail,
    submitPublic
  };

  fastify.sequelize.syncPromise.then(() => syncDefaultTemplates()).catch(err => {
    fastify.log.error(err);
  });
});
