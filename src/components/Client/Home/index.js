import { useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page, useIsMobile, useScrollElement } from '@kne/system-layout';
import { App, Button } from 'antd';
import { useIntl } from '@kne/react-intl';
import { useNavigate } from 'react-router-dom';
import withLocale from '../withLocale';
import withQuestionnaireLocale from '@components/Questionnaire/withLocale';
import { renderListCards } from '@components/Questionnaire/listCards';
import { ProjectCreateForm } from '@components/QuestionnaireProject';
import useProjectActions from '@components/QuestionnaireProject/useProjectActions';
import style from './style.module.scss';

const Home = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-admin:BizUnit@TablePageRender', 'components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:Modal@useModal']
})(
  withLocale(withQuestionnaireLocale(({ remoteModules }) => {
    const [BizUnit, TablePageRender, usePreset, FormInfo, useModal] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const formModal = FormInfo.useFormModal();
    const modal = useModal();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const [projectListKey, setProjectListKey] = useState(0);
    const { getActionList } = useProjectActions({
      ajax,
      apis,
      formModal,
      modal,
      message,
      formatMessage,
      navigate,
      onChanged: () => setProjectListKey(key => key + 1),
      renderCreateForm: onAddTemplate => <ProjectCreateForm FormInfo={FormInfo} apis={apis} formatMessage={formatMessage} onAddTemplate={onAddTemplate} />
    });
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
                      Object.assign({}, apis.questionnaire.templateList, { params: { perPage: 4, currentPage: 1 } })
                    );
                    const pageData = resData.code === 0 ? resData.data?.pageData || [] : [];
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
              key={projectListKey}
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
              getActionList={getActionList}
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
  }))
);

export default Home;
