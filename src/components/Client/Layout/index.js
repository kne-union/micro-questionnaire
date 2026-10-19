import { createWithRemoteLoader } from '@kne/remote-loader';
import { Outlet } from 'react-router-dom';
import { LogoutOutlined } from '@ant-design/icons';

import SystemLayout from '@kne/system-layout';
import '@kne/system-layout/dist/index.css';

import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const Layout = createWithRemoteLoader({
  modules: ['components-admin:Authenticate@AfterUserLogin', 'components-core:Global@GlobalValue', 'components-admin:Account@useLogout', 'components-admin:Account@Language']
})(
  withLocale(({ remoteModules, baseUrl, children }) => {
    const [AfterUserLogin, GlobalValue, useLogout, Language] = remoteModules;
    const { formatMessage } = useIntl();
    const logout = useLogout();

    return (
      <AfterUserLogin>
        <GlobalValue globalKey="userInfo">
          {({ value }) => {
            const userInfo = value?.value;
            return (
              <SystemLayout
                logo={{
                  src: `${window.location.origin}${process.env.PUBLIC_URL || ''}/logo.svg`,
                  alt: 'questionnaire'
                }}
                userInfo={Object.assign({}, userInfo, {
                  name: userInfo?.nickname || userInfo?.name || userInfo?.email,
                  extra: <Language />
                })}
                background={'linear-gradient(180deg, #E8DCDF, #E1D1E3, #DED7EF, #D5E0F1)'}
                menu={{
                  base: baseUrl,
                  items: [
                    {
                      path: '/',
                      label: formatMessage({ id: 'ClientAdminHome' }),
                      toolbar: true,
                      icon: 'home'
                    },
                    {
                      path: '/project',
                      label: formatMessage({ id: 'QuestionnaireProjectMenu' }),
                      toolbar: true,
                      icon: 'snippet_folder'
                    },
                    {
                      path: '/template',
                      label: formatMessage({ id: 'QuestionnaireTemplateMenu' }),
                      toolbar: true,
                      icon: 'assignment'
                    },
                    {
                      group: 'account',
                      groupLabel: formatMessage({ id: 'ClientMenuAccount' }),
                      label: formatMessage({ id: 'ClientMenuLogout' }),
                      icon: <LogoutOutlined />,
                      onClick: logout
                    }
                  ]
                }}
              >
                {children || <Outlet />}
              </SystemLayout>
            );
          }}
        </GlobalValue>
      </AfterUserLogin>
    );
  })
);

export default Layout;
