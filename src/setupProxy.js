const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8060',
      changeOrigin: true
    })
  );
  app.use(
    createProxyMiddleware(path => path === '/oidc' || path.startsWith('/oidc/'), {
      target: 'http://localhost:8060',
      xfwd: true
    })
  );
};
