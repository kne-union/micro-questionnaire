import RemoteLoader, { createWithRemoteLoader } from '@kne/remote-loader';
import AppChildrenRouter from '@kne/app-children-router';
import { Navigate } from 'react-router-dom';
import Admin from '@components/Admin';



import Client from '@components/Client';

import './index.scss';

const App = createWithRemoteLoader({
  modules: ['components-core:Global', 'components-admin:Authenticate@AfterUserLoginLayout', 'components-admin:Authenticate@AfterAdminUserLoginLayout']
})(({ remoteModules, globalPreset }) => {
  const [Global, AfterUserLoginLayout, AfterAdminUserLoginLayout] = remoteModules;
  const baseUrl = '';
  const systemName = 'questionnaire';

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
      {
        key: 'message',
        title: '消息管理',
        path: `${baseUrl}/admin/message`
      }
    ]
  };

  const routes = [
    {
      path: 'account/*',
      title: 'Account',
      element: <RemoteLoader module="components-admin:Account" baseUrl={baseUrl + '/account'} systemName={systemName} />
    },
    {
      path: 'admin/initAdmin',
      title: 'Init Admin',
      element: (
        <AppChildrenRouter
          element={<AfterUserLoginLayout />}
          list={[
            {
              index: true,
              element: <RemoteLoader module="components-admin:Admin@InitAdmin" />
            }
          ]}
        />
      )
    },
    {
      path: 'admin/*',
      title: 'Admin',
      element: (
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
            {
              path: 'message/*',
              title: '消息管理',
              element: <RemoteLoader module="components-admin:MessageManger" baseUrl={`${baseUrl}/admin/message`} />
            }
          ]}
        >
          <Admin baseUrl={baseUrl + '/admin'}>
            <RemoteLoader module="components-admin:Admin" baseUrl={baseUrl + '/admin'} />
          </Admin>
        </AppChildrenRouter>
      )
    }
  ];










  routes.push({
    path: '*',
    element: (
      <Client baseUrl={baseUrl} />
    )
  });


  return (
    <Global preset={globalPreset} themeToken={globalPreset.themeToken}>
      <AppChildrenRouter errorPage notFoundPage baseUrl={baseUrl} list={routes} />
    </Global>
  );
});

export default App;
