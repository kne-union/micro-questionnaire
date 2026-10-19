import AppChildrenRouter from '@kne/app-children-router';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import ClientLayout from './Layout';

const Client = withLocale(({ baseUrl }) => {
  const { formatMessage } = useIntl();

  return (
    <AppChildrenRouter
      errorPage
      notFoundPage
      baseUrl={baseUrl}
      element={<ClientLayout baseUrl={baseUrl} />}
      list={[
        {
          index: true,
          title: formatMessage({ id: 'ClientAdminHome' }),
          loader: () => import('./Home')
        },
        {
          path: 'template',
          title: formatMessage({ id: 'QuestionnaireTemplateMenu' }),
          loader: () => import('@components/QuestionnaireTemplate')
        },
        {
          path: 'project',
          title: formatMessage({ id: 'QuestionnaireProjectMenu' }),
          loader: () => import('@components/QuestionnaireProject')
        },
        {
          path: 'project/:id/results',
          title: formatMessage({ id: 'QuestionnaireResultMenu' }),
          loader: () => import('@components/QuestionnaireResult')
        }
      ]}
    />
  );
});

export default Client;
