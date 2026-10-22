const fp = require('fastify-plugin');

const idType = { anyOf: [{ type: 'string' }, { type: 'number' }] };

const listQuery = {
  type: 'object',
  additionalProperties: true,
  properties: {
    perPage: { type: 'number' },
    currentPage: { type: 'number' },
    keyword: { type: 'string' },
    templateId: { type: 'string' },
    status: { type: 'string' },
    kind: { type: 'string' },
    locale: { type: 'string' },
    updatedAt: {},
    filter: { type: 'object', additionalProperties: true }
  }
};

const readFilterValue = (query, name) => {
  if (query[name] != null && query[name] !== '') {
    return query[name];
  }
  const nested = query.filter;
  if (nested && typeof nested === 'object' && nested[name] != null && nested[name] !== '') {
    return nested[name];
  }
  return undefined;
};

const toListParams = query => ({
  perPage: query.perPage || 20,
  currentPage: query.currentPage || 1,
  locale: query.locale,
  filter: {
    keyword: readFilterValue(query, 'keyword'),
    templateId: readFilterValue(query, 'templateId'),
    status: readFilterValue(query, 'status'),
    kind: readFilterValue(query, 'kind'),
    updatedAt: readFilterValue(query, 'updatedAt')
  }
});

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
  const userAuth = [authenticate.user];

  fastify.get(`${options.prefix}/questionnaire/template/list`, { onRequest: userAuth, schema: { summary: '问卷模版列表', querystring: listQuery } }, async request => {
    return services.questionnaire.getTemplateList(request.userInfo, toListParams(request.query));
  });

  fastify.get(
    `${options.prefix}/questionnaire/template/detail`,
    {
      onRequest: userAuth,
      schema: { summary: '问卷模版详情', querystring: { type: 'object', properties: { id: idType, locale: { type: 'string' } }, required: ['id'] } }
    },
    async request => services.questionnaire.getTemplateDetail(request.userInfo, request.query)
  );

  fastify.post(
    `${options.prefix}/questionnaire/template/save`,
    {
      onRequest: userAuth,
      schema: {
        summary: '新建或保存问卷模版',
        body: {
          type: 'object',
          properties: {
            id: idType,
            name: { type: 'string' },
            description: { type: 'string' },
            languages: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: ['zh-CN', 'en-US'] } },
            schema: { type: 'object' }
          }
        }
      }
    },
    async request => services.questionnaire.saveTemplate(request.userInfo, request.body)
  );

  fastify.post(
    `${options.prefix}/questionnaire/template/remove`,
    {
      onRequest: userAuth,
      schema: { summary: '删除问卷模版', body: { type: 'object', properties: { id: idType }, required: ['id'] } }
    },
    async request => services.questionnaire.removeTemplate(request.userInfo, request.body)
  );

  fastify.post(
    `${options.prefix}/questionnaire/template/generate`,
    {
      onRequest: userAuth,
      schema: {
        summary: '按场景描述生成问卷模版',
        body: {
          type: 'object',
          properties: {
            source: { type: 'string', minLength: 1, maxLength: 5000 },
            locale: { type: 'string', enum: ['zh-CN', 'en-US'] },
            languages: { type: 'array', items: { type: 'string', enum: ['zh-CN', 'en-US'] } },
            currentSchema: { type: 'object' }
          },
          required: ['source']
        }
      }
    },
    async request => services.questionnaire.generateSchema(request.body)
  );

  fastify.get(`${options.prefix}/questionnaire/project/list`, { onRequest: userAuth, schema: { summary: '问卷项目列表', querystring: listQuery } }, async request => {
    return services.questionnaire.getProjectList(request.userInfo, toListParams(request.query));
  });

  fastify.get(
    `${options.prefix}/questionnaire/project/detail`,
    {
      onRequest: userAuth,
      schema: { summary: '问卷项目详情', querystring: { type: 'object', properties: { id: idType }, required: ['id'] } }
    },
    async request => services.questionnaire.getProjectDetail(request.userInfo, request.query)
  );

  fastify.post(
    `${options.prefix}/questionnaire/project/create`,
    {
      onRequest: userAuth,
      schema: {
        summary: '从模版创建问卷项目',
        body: {
          type: 'object',
          properties: {
            templateId: idType,
            name: {},
            description: {},
            language: { type: 'string', enum: ['zh-CN', 'en-US', 'both'] },
            background: {},
            banners: {},
            themeColor: {},
            copyFromId: idType
          },
          required: ['templateId']
        }
      }
    },
    async request => services.questionnaire.createProject(request.userInfo, request.body)
  );

  fastify.post(
    `${options.prefix}/questionnaire/project/appearance`,
    {
      onRequest: userAuth,
      schema: {
        summary: '设置问卷填写页背景和 Banner',
        body: {
          type: 'object',
          properties: {
            id: idType,
            background: {},
            banners: {},
            themeColor: {}
          },
          required: ['id']
        }
      }
    },
    async request => services.questionnaire.updateAppearance(request.userInfo, request.body)
  );

  fastify.post(
    `${options.prefix}/questionnaire/project/poster/generate`,
    {
      onRequest: userAuth,
      schema: {
        summary: 'AI 生成问卷分享海报 HTML（二维码、背景图以 {{qrcode}}、{{background}} 占位）',
        body: {
          type: 'object',
          properties: {
            id: idType,
            width: { type: 'number', minimum: 200, maximum: 4000 },
            height: { type: 'number', minimum: 200, maximum: 4000 },
            requirement: { type: 'string', maxLength: 2000 },
            locale: { type: 'string', enum: ['zh-CN', 'en-US'] }
          },
          required: ['id', 'width', 'height']
        }
      }
    },
    async request => services.questionnaire.generatePoster(request.userInfo, request.body)
  );

  fastify.get(
    `${options.prefix}/questionnaire/project/poster/list`,
    {
      onRequest: userAuth,
      schema: { summary: '问卷已保存的 AI 海报列表（最新在前，最多 20 张）', querystring: { type: 'object', properties: { id: idType }, required: ['id'] } }
    },
    async request => services.questionnaire.getPosterList(request.userInfo, request.query)
  );

  fastify.post(
    `${options.prefix}/questionnaire/project/poster/remove`,
    {
      onRequest: userAuth,
      schema: { summary: '删除已保存的 AI 海报', body: { type: 'object', properties: { id: idType }, required: ['id'] } }
    },
    async request => services.questionnaire.removePoster(request.userInfo, request.body)
  );

  fastify.post(
    `${options.prefix}/questionnaire/project/poster/background`,
    {
      onRequest: userAuth,
      schema: {
        summary: '保存默认海报背景图，传空数组恢复使用填写页背景图',
        body: {
          type: 'object',
          properties: {
            id: idType,
            background: { type: 'array', items: { type: 'object', additionalProperties: true } }
          },
          required: ['id']
        }
      }
    },
    async request => services.questionnaire.savePosterBackground(request.userInfo, request.body)
  );

  fastify.post(
    `${options.prefix}/questionnaire/project/appearance/generate`,
    {
      onRequest: userAuth,
      schema: {
        summary: 'AI 生成填写页背景图或 Banner 的 HTML（前端渲染为图片后上传）',
        body: {
          type: 'object',
          properties: {
            id: idType,
            kind: { type: 'string', enum: ['background', 'banner'] },
            requirement: { type: 'string', maxLength: 2000 },
            locale: { type: 'string', enum: ['zh-CN', 'en-US'] }
          },
          required: ['id', 'kind']
        }
      }
    },
    async request => services.questionnaire.generateAppearanceImage(request.userInfo, request.body)
  );

  fastify.post(
    `${options.prefix}/questionnaire/project/close`,
    {
      onRequest: userAuth,
      schema: { summary: '关闭问卷项目', body: { type: 'object', properties: { id: idType }, required: ['id'] } }
    },
    async request => services.questionnaire.closeProject(request.userInfo, request.body)
  );

  fastify.post(
    `${options.prefix}/questionnaire/project/open`,
    {
      onRequest: userAuth,
      schema: { summary: '重新打开问卷项目', body: { type: 'object', properties: { id: idType }, required: ['id'] } }
    },
    async request => services.questionnaire.openProject(request.userInfo, request.body)
  );

  fastify.get(
    `${options.prefix}/questionnaire/project/response/list`,
    {
      onRequest: userAuth,
      schema: {
        summary: '问卷项目答卷列表',
        querystring: {
          type: 'object',
          properties: {
            id: idType,
            perPage: { type: 'number' },
            currentPage: { type: 'number' }
          },
          required: ['id']
        }
      }
    },
    async request =>
      services.questionnaire.getResponseList(request.userInfo, {
        id: request.query.id,
        perPage: request.query.perPage || 20,
        currentPage: request.query.currentPage || 1
      })
  );

  fastify.get(
    `${options.prefix}/questionnaire/project/export`,
    {
      onRequest: userAuth,
      schema: { summary: '下载问卷结果', querystring: { type: 'object', properties: { id: idType, locale: { type: 'string' } }, required: ['id'] } }
    },
    async (request, reply) => {
      const { file, contentType } = await services.questionnaire.exportProject(request.userInfo, request.query);
      reply.header('Content-Type', contentType).header('Content-Disposition', 'attachment; filename="questionnaire.xlsx"');
      return file;
    }
  );

  fastify.post(
    `${options.prefix}/questionnaire/project/invite`,
    {
      onRequest: userAuth,
      schema: {
        summary: '为指定填写人发起问卷（独立短码，提交后回调 webhook）',
        body: {
          type: 'object',
          properties: {
            projectId: idType,
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            externalId: idType,
            webhook: { type: 'string', description: '提交后 POST { event, invite, project, response }；校验参数由调用方自行放在地址中' },
            expiresAt: { type: 'string', description: '链接过期时间 ISO 字符串，不传则不过期' }
          },
          required: ['projectId']
        }
      }
    },
    async request => services.questionnaire.createInvite(request.userInfo, request.body)
  );

  fastify.get(
    `${options.prefix}/questionnaire/project/invite/detail`,
    {
      onRequest: userAuth,
      schema: { summary: '问卷邀请详情', querystring: { type: 'object', properties: { id: idType }, required: ['id'] } }
    },
    async request => services.questionnaire.getInviteDetail(request.userInfo, request.query)
  );

  fastify.get(
    `${options.prefix}/questionnaire/public/detail`,
    {
      schema: { summary: '通过短码获取问卷', querystring: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } }
    },
    async request => services.questionnaire.getPublicDetail(request.query)
  );

  fastify.post(
    `${options.prefix}/questionnaire/public/submit`,
    {
      schema: {
        summary: '通过短码提交问卷',
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            answers: { type: 'object' }
          },
          required: ['code', 'answers']
        }
      }
    },
    async request => services.questionnaire.submitPublic(request.body)
  );
});
