# micro-questionnaire

问卷系统。登录后维护自己的模版和项目，把填写链接发出去，收回答卷并导出结果。填写页不需要登录。问卷数据按当前用户隔离。

仓库：https://github.com/kne-union/micro-questionnaire

## 本地启动

```bash
npm install
npm run init-server
npm start
```

- 前端：http://localhost:3060
- 接口：http://localhost:8060 ，前缀 `/api/v1`
- 默认数据库：`server/data.db`（SQLite，已忽略，不入库）

首次使用先打开 `/account` 注册，再在 `/admin/initAdmin` 初始化超级管理员。问卷工作在登录后的首页进行，平台账号、文件、任务和消息在 `/admin`。

服务端环境变量写在 `server/.env`（不入库）。字段说明见 `server/env.schema.json`。本地不配邮件时，把 `IS_TEST` 设为 `true`，验证码会直接出现在接口返回里。

| 变量 | 作用 |
| --- | --- |
| `PORT` | 接口端口，默认 `8060` |
| `ORIGIN` | 站点地址，用于重置密码链接和问卷填写链接 |
| `IS_TEST` | 为 `true` 时不真正发信，并在接口中返回验证码 |
| `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_CHAT_DEPLOYMENT` | 按场景描述生成模版。不配则不能使用生成，其它功能不受影响 |
| `ALISMTP_USER` / `ALISMTP_PASSWORD` / `ALISMTP_ENDPOINT` | 发信 |

## 能做什么

- **首页**：快速创建，展示最近更新的 4 个模版，用来开新项目。
- **模版**：新建、保存、删除。也可以用一段场景描述生成模版。
- **项目**：从模版创建。可以设置填写页背景、Banner 和主题色，关闭或重新打开。复制的填写链接是 `/q/{code}`；部署在子路径下时会带上该前缀。
- **填写**：`/q/:code` 免登录。关闭的项目不能再提交。
- **结果**：在项目里查看答卷，并下载结果。

## 构建

```bash
npm run build
```

产物在 `build/`。部署到应用中心时用 `npx @kne/npm-tools packApp` 打包，不要把 `node_modules`、`server/.env` 和 `server/data.db` 打进去。
