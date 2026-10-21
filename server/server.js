
const fastify = require('fastify')({
  logger: true,
  querystringParser: str => require('qs').parse(str)
});

const fastifyEnv = require('@fastify/env');
const packageJson = require('./package.json');
const path = require('path');

const version = `v${packageJson.version.split('.')[0]}`;

const options = {
  name: 'project',
  prefix: `/api/${version}`,
  taskCron: '*/1 * * * *',
  getUserModel: () => {
    return fastify.account.models.user;
  }
};



const createServer = () => {
  const userEnvSchema = require('./env.schema.json');
  fastify.register(fastifyEnv, {
    dotenv: { path: path.join(__dirname, '.env') },
    schema: {
      type: 'object',
      properties: Object.assign({}, userEnvSchema.properties, {
        PORT: { type: 'number', default: 8060 },
        DB_DIALECT: { type: 'string', default: 'sqlite' },
        DB_HOST: { type: 'string', default: 'data.db' },
        DB_PORT: { type: 'number' },
        DB_USERNAME: { type: 'string' },
        DB_PASSWORD: { type: 'string' },
        DB_DATABASE: { type: 'string' }
      }),
      required: userEnvSchema.required || []
    }
  });

  // 须在其它插件之前注册，否则收集不到先定义的路由；文档由 @kne/fastify-app-runtime 的 /open-api.json 输出
  const appPackageJson = require('../package.json');
  fastify.register(require('@fastify/swagger'), {
    openapi: {
      info: { title: appPackageJson.name, version: appPackageJson.version }
    }
  });

  fastify.register(require('fastify-cron'));

  fastify.register(
    require('fastify-plugin')(async fastify => {
      fastify.register(require('@kne/fastify-sequelize'), {
        db: {
          dialect: fastify.config.DB_DIALECT,
          host: fastify.config.DB_HOST,
          port: fastify.config.DB_PORT,
          database: fastify.config.DB_DATABASE,
          username: fastify.config.DB_USERNAME,
          password: fastify.config.DB_PASSWORD
        },
        modelsGlobOptions: {
          syncOptions: {}
        },
        getUserModel: options.getUserModel
      });

      fastify.register(require('@kne/fastify-account'), {
        isTest: fastify.config.IS_TEST,
        prefix: `${options.prefix}`,
        getUserAuthenticate: () => fastify.oidc.authenticate.user,
        sendMessage: async ({ name, type, messageType, props }) => {
          if (messageType === 1 && type === 0) {
            await fastify.message.services.sendMessage({
              name,
              type: 0,
              code: 'REGISTERCODE',
              props,
              options: {
                title: '注册验证码'
              }
            });
          }
          if (messageType === 1 && type === 5) {
            await fastify.message.services.sendMessage({
              name,
              type: 0,
              code: 'RESETPASSWORDCODE',
              props: Object.assign({}, props, {
                url: `${fastify.config.ORIGIN}/account/reset-password/${props.token}${props.options?.referer ? `?referer=${props.options?.referer}` : ''}`
              }),
              options: {
                title: '重置密码'
              }
            });
          }
        }
      });

      fastify.register(require('@kne/fastify-message'), {
        isTest: fastify.config.IS_TEST,
        prefix: `${options.prefix}/message`,
        emailConfig: {
          host: fastify.config.ALISMTP_ENDPOINT,
          port: 465,
          secure: true,
          user: fastify.config.ALISMTP_USER,
          pass: fastify.config.ALISMTP_PASSWORD
        },
        templateDir: path.join(__dirname, './messageTemplate'),
        senders: {}
      });

      fastify.register(require('@kne/fastify-task'), {
        prefix: `${options.prefix}/task`,
        cronTime: options.taskCron,
        task: {
        }
      });

      fastify.register(require('@kne/fastify-oidc'), {
        selfClient: { clientName: 'Questionnaire' },
        origin: fastify.config.ORIGIN || 'http://localhost:3060',
        keyEncryptionSecret: fastify.config.OIDC_KEY_SECRET
      });
    })
  );

  fastify.register(
    require('fastify-plugin')(async fastify => {

      fastify.register(require('@kne/fastify-file-manager'), {
        prefix: `${options.prefix}/static`,
        root: path.resolve('./static')
      });
    })
  );

  fastify.register(
    require('fastify-plugin')(async fastify => {
      await fastify.register(require('@kne/fastify-shorten'));

      fastify.register(require('@kne/fastify-namespace'), {
        options,
        name: options.name,
        modules: [
          ['controllers', path.resolve(__dirname, './libs/controllers')],
          [
            'models',
            await fastify.sequelize.addModels(path.resolve(__dirname, './libs/models'), {
              getUserModel: options.getUserModel
            })
          ],
          ['services', path.resolve(__dirname, './libs/services')]
        ]
      });
      await fastify.sequelize.sync();
    })
  );

  fastify.register(
    require('fastify-plugin')(async fastify => {
      const buildRoot = path.join(__dirname, './build');
      require('node:fs').mkdirSync(buildRoot, { recursive: true });
      await fastify.register(require('@kne/fastify-app-runtime'), {
        root: buildRoot,
        packageJson: require('../package.json'),
        setting: {
          prefix: `${options.prefix}/setting`
        }
      });
    })
  );

  fastify.register(require('@kne/fastify-response-data-format'));
};

module.exports = {
  fastify,
  createServer,
  start: () => {
    createServer();
    return fastify.then(() => {
      fastify.listen({ port: fastify.config.PORT, host: '0.0.0.0' }, (err, address) => {
        if (err) throw err;
        console.log(`Server is now listening on ${address}`);
      });
    });
  }
};
