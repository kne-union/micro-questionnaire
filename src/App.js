import { useEffect } from 'react';
import RemoteLoader, { createWithRemoteLoader } from '@kne/remote-loader';
import AppChildrenRouter from '@kne/app-children-router';
import { Navigate } from 'react-router-dom';
import Admin from '@components/Admin';



import Client from '@components/Client';
import QuestionnaireFill from './pages/QuestionnaireFill';
import { getOidcClient } from './commons/oidcClient';

import './index.scss';

const Protected = ({ children }) => <RemoteLoader module="components-admin:Oidc@OidcAuthenticate">{children}</RemoteLoader>;

const AccountLoginRedirect = () => {
  useEffect(() => {
    getOidcClient().logout();
  }, []);
  return null;
};

const App = createWithRemoteLoader({
  modules: ['components-core:Global', 'components-admin:Authenticate@AfterUserLoginLayout', 'components-admin:Authenticate@AfterAdminUserLoginLayout']
})(({ remoteModules, globalPreset }) => {
  const [Global, AfterUserLoginLayout, AfterAdminUserLoginLayout] = remoteModules;
  const baseUrl = '';
  const systemName = 'questionnaire';
  const isOidcClient = globalPreset.oidcMode === 'central';

  const adminNavigation = {
    base: `${baseUrl}/admin`,
    showIndex: false,
    defaultTitle: systemName,
    list: [
      {
        key: 'task',
        title: '任务管理',
        path: `${baseUrl}/admin/task`
      },
      {
        key: 'tenant',
        title: '租户管理',
        path: `${baseUrl}/admin/tenant`
      },
      {
        key: 'user',
        title: '用户管理',
        path: '/admin/user'
      },
      {
        key: 'file',
        title: '文件管理',
        path: `${baseUrl}/admin/file`
      },
      !isOidcClient && {
        key: 'oidc',
        title: '统一认证',
        path: `${baseUrl}/admin/oidc`
      },
      {
        key: 'message',
        title: '消息管理',
        path: `${baseUrl}/admin/message`
      }
    ].filter(Boolean)
  };

  const routes = [
    {
      path: 'oidc-interaction',
      title: 'Login',
      element: <RemoteLoader module="components-admin:Oidc@Interaction" systemName={systemName} registerUrl={`${baseUrl}/account/register`} forgetUrl={`${baseUrl}/account/forget`} />
    },
    {
      path: 'oidc-callback',
      title: 'Login',
      element: <RemoteLoader module="components-admin:Oidc@Callback" systemName={systemName} />
    },
    {
      path: 'account/login',
      title: 'Login',
      element: <AccountLoginRedirect />
    },
    {
      path: 'account/*',
      title: 'Account',
      element: <RemoteLoader module="components-admin:Account" baseUrl={baseUrl + '/account'} systemName={systemName} />
    },
    {
      path: 'admin/initAdmin',
      title: 'Init Admin',
      element: (
        <Protected>
          <AppChildrenRouter
            element={<AfterUserLoginLayout />}
            list={[
              {
                index: true,
                element: <RemoteLoader module="components-admin:Admin@InitAdmin" />
              }
            ]}
          />
        </Protected>
      )
    },
    {
      path: 'admin/*',
      title: 'Admin',
      element: (
        <Protected>
          <AppChildrenRouter
            errorPage
            notFoundPage
            baseUrl={baseUrl + '/admin'}
            element={<AfterAdminUserLoginLayout navigation={adminNavigation} />}
            list={[
            {
              index: true,
              element: <Navigate to={`${baseUrl}/admin/tenant`} replace />
            },
            {
              path: 'tenant/*',
              title: '租户管理',
              element: <RemoteLoader module="components-admin:TenantAdmin" baseUrl={baseUrl + '/admin'} />
            },
            {
              path: 'task/*',
              title: '任务管理',
              element: <RemoteLoader module="components-admin:Task" baseUrl={baseUrl + '/admin'} />
            },
            {
              path: 'file',
              title: '文件管理',
              element: <RemoteLoader module="components-file-manager:FileListPage" />
            },
            !isOidcClient && {
              path: 'oidc/*',
              title: '统一认证',
              element: <RemoteLoader module="components-admin:OidcAdmin" baseUrl={`${baseUrl}/admin/oidc`} />
            },
            {
              path: 'message/*',
              title: '消息管理',
              element: <RemoteLoader module="components-admin:MessageManger" baseUrl={`${baseUrl}/admin/message`} />
            }
          ].filter(Boolean)}
        >
          <Admin baseUrl={baseUrl + '/admin'}>
            <RemoteLoader module="components-admin:Admin" baseUrl={baseUrl + '/admin'} />
          </Admin>
        </AppChildrenRouter>
        </Protected>
      )
    }
  ];










  routes.push({
    path: 'q/:code',
    title: '问卷',
    element: <QuestionnaireFill />
  });

  routes.push({
    path: '*',
    element: (
      <Protected>
        <Client baseUrl={baseUrl} />
      </Protected>
    )
  });


  return (
    <Global preset={globalPreset} themeToken={globalPreset.themeToken}>
      <AppChildrenRouter errorPage notFoundPage baseUrl={baseUrl} list={routes} />
    </Global>
  );
});

export default App;
