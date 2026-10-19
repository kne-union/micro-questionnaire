import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page, useIsMobile, useScrollElement } from '@kne/system-layout';
import { Button } from 'antd';
import { useIntl } from '@kne/react-intl';
import { useNavigate } from 'react-router-dom';
import withLocale from '../withLocale';
import { renderListCards } from '@components/Questionnaire/listCards';
import style from './style.module.scss';

const TEMPLATE_ORDER = ['event-registration', 'satisfaction', 'meeting-feedback', 'requirement'];

const Home = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-admin:BizUnit@TablePageRender', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules }) => {
    const [BizUnit, TablePageRender, usePreset] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const navigate = useNavigate();
    const getScrollElement = useScrollElement();
    const isMobile = useIsMobile();
    const tableProps = {
      pagination: { open: false, pageSize: 4 },
      renderMobile: renderListCards,
      renderCard: renderListCards,
      getScrollContainer: getScrollElement,
      scrollTopInset: isMobile ? 48 : 0
    };

    return (
      <Page
        title={formatMessage({ id: 'ClientAdminHomeTitle' })}
        extra={
          <div className={style.actions}>
            <Button type="primary" onClick={() => navigate('/project')}>
              {formatMessage({ id: 'ClientHomeGoProjects' })}
            </Button>
            <Button onClick={() => navigate('/template')}>{formatMessage({ id: 'ClientHomeGoTemplates' })}</Button>
          </div>
        }
      >
        <div className={style.home}>
          <section className={style.hero}>
            <p className={style.lead}>{formatMessage({ id: 'ClientAdminHomeDescription' })}</p>
          </section>

          <section>
            <h2 className={style.sectionTitle}>{formatMessage({ id: 'ClientHomeDefaults' })}</h2>
            <p className={style.sectionHint}>{formatMessage({ id: 'ClientHomeDefaultsHint' })}</p>
            <BizUnit
              isNext
              name="questionnaire-home-templates"
              allowKeywordSearch={false}
              apis={{
                list: {
                  loader: async () => {
                    const { data: resData } = await ajax(
                      Object.assign({}, apis.questionnaire.templateList, { params: { perPage: 50, currentPage: 1 } })
                    );
                    const pageData =
                      resData.code === 0
                        ? (resData.data?.pageData || [])
                            .filter(item => item.builtinKey)
                            .sort((a, b) => TEMPLATE_ORDER.indexOf(a.builtinKey) - TEMPLATE_ORDER.indexOf(b.builtinKey))
                        : [];
                    return { pageData, totalCount: pageData.length };
                  }
                }
              }}
              getColumns={() => [
                {
                  name: 'name',
                  title: formatMessage({ id: 'ClientHomeTemplateName' }),
                  renderType: 'main',
                  onClick: ({ colItem }) =>
                    navigate('/template', {
                      state: { templateId: colItem.id, name: colItem.name, description: colItem.description }
                    })
                },
                {
                  name: 'description',
                  title: formatMessage({ id: 'ClientHomeTemplateDescription' }),
                  renderType: 'description'
                }
              ]}
              getActionList={({ data, ...actionProps }) => [
                {
                  ...actionProps,
                  data,
                  children: formatMessage({ id: 'ClientHomeUseTemplate' }),
                  onClick: () =>
                    navigate('/project', {
                      state: { templateId: data.id, name: data.name, description: data.description }
                    })
                }
              ]}
              options={{
                bizName: formatMessage({ id: 'ClientHomeDefaults' }),
                tableProps
              }}
            >
              {renderProps => <TablePageRender {...renderProps} withPage={false} />}
            </BizUnit>
          </section>

          <section>
            <h2 className={`${style.sectionTitle} ${style.sectionTitleGap}`}>{formatMessage({ id: 'ClientHomeRecent' })}</h2>
            <BizUnit
              isNext
              name="questionnaire-home-projects"
              allowKeywordSearch={false}
              apis={{
                list: {
                  loader: async () => {
                    const { data: resData } = await ajax(
                      Object.assign({}, apis.questionnaire.projectList, { params: { perPage: 5, currentPage: 1 } })
                    );
                    const pageData = resData.code === 0 ? resData.data?.pageData || [] : [];
                    return { pageData, totalCount: pageData.length };
                  }
                }
              }}
              getColumns={() => [
                {
                  name: 'name',
                  title: formatMessage({ id: 'ClientHomeProjectName' }),
                  renderType: 'main',
                  onClick: ({ colItem }) => navigate(`/project/${colItem.id}/results`)
                },
                {
                  name: 'responseCount',
                  title: formatMessage({ id: 'ClientHomeResponseCount' }),
                  getValueOf: item => item.responseCount || 0
                },
                {
                  name: 'status',
                  title: formatMessage({ id: 'ClientHomeProjectStatus' }),
                  renderType: 'tag',
                  getValueOf: item => ({
                    type: item.status === 'open' ? 'success' : 'default',
                    text: formatMessage({ id: item.status === 'open' ? 'ClientHomeOpen' : 'ClientHomeClosed' })
                  })
                }
              ]}
              getActionList={({ data, ...actionProps }) => [
                {
                  ...actionProps,
                  data,
                  children: formatMessage({ id: 'ClientHomeViewProject' }),
                  onClick: () => navigate(`/project/${data.id}/results`)
                }
              ]}
              options={{
                bizName: formatMessage({ id: 'ClientHomeRecent' }),
                tableProps
              }}
            >
              {renderProps => <TablePageRender {...renderProps} withPage={false} />}
            </BizUnit>
          </section>
        </div>
      </Page>
    );
  })
);

export default Home;
