import { useEffect, useRef, useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page, useIsMobile, useScrollElement } from '@kne/system-layout';
import { App, Button, Skeleton } from 'antd';
import { BarChartOutlined, FileTextOutlined, PlusOutlined, RightOutlined, SendOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import { useNavigate } from 'react-router-dom';
import classnames from 'classnames';
import withLocale from '../withLocale';
import withQuestionnaireLocale from '@components/Questionnaire/withLocale';
import { renderListCards } from '@components/Questionnaire/listCards';
import { ProjectCreateForm } from '@components/QuestionnaireProject';
import useProjectActions from '@components/QuestionnaireProject/useProjectActions';
import style from './style.module.scss';

const requestTotal = async (ajax, api, params) => {
  const { data: resData } = await ajax(Object.assign({}, api, { params: Object.assign({ perPage: 1, currentPage: 1 }, params) }));
  return resData.code === 0 ? resData.data?.totalCount || 0 : null;
};

const useHomeData = ({ ajax, apis, refreshKey }) => {
  const [stats, setStats] = useState(null);
  const [templates, setTemplates] = useState(null);
  const presetRef = useRef({ ajax, apis });
  presetRef.current = { ajax, apis };

  useEffect(() => {
    let active = true;
    const { ajax, apis } = presetRef.current;
    const { projectList, templateList } = apis.questionnaire;
    Promise.all([requestTotal(ajax, projectList), requestTotal(ajax, projectList, { status: 'open' }), requestTotal(ajax, projectList, { status: 'closed' }), requestTotal(ajax, templateList, { kind: 'custom' })]).then(
      ([total, open, closed, customTemplates]) => {
        active && setStats({ total, open, closed, customTemplates });
      }
    );
    ajax(Object.assign({}, templateList, { params: { perPage: 4, currentPage: 1 } })).then(({ data: resData }) => {
      active && setTemplates(resData.code === 0 ? resData.data?.pageData || [] : []);
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return { stats, templates };
};

const SectionHeader = ({ title, hint, linkText, onLinkClick }) => (
  <header className={style.sectionHeader}>
    <div>
      <h2 className={style.sectionTitle}>{title}</h2>
      {hint ? <p className={style.sectionHint}>{hint}</p> : null}
    </div>
    {linkText ? (
      <Button type="link" className={style.sectionLink} onClick={onLinkClick}>
        {linkText}
        <RightOutlined />
      </Button>
    ) : null}
  </header>
);

const Home = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-admin:BizUnit@TablePageRender', 'components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:Modal@useModal']
})(
  withLocale(
    withQuestionnaireLocale(({ remoteModules }) => {
      const [BizUnit, TablePageRender, usePreset, FormInfo, useModal] = remoteModules;
      const { apis, ajax } = usePreset();
      const { formatMessage } = useIntl();
      const formModal = FormInfo.useFormModal();
      const modal = useModal();
      const { message } = App.useApp();
      const navigate = useNavigate();
      const [refreshKey, setRefreshKey] = useState(0);
      const { openCreate, getActionList } = useProjectActions({
        ajax,
        apis,
        formModal,
        modal,
        message,
        formatMessage,
        navigate,
        onChanged: () => setRefreshKey(key => key + 1),
        renderCreateForm: onAddTemplate => <ProjectCreateForm FormInfo={FormInfo} apis={apis} formatMessage={formatMessage} onAddTemplate={onAddTemplate} />
      });
      const { stats, templates } = useHomeData({ ajax, apis, refreshKey });
      const getScrollElement = useScrollElement();
      const isMobile = useIsMobile();

      const steps = [
        { key: 'template', icon: <FileTextOutlined />, title: 'ClientHomeStepTemplate', desc: 'ClientHomeStepTemplateDesc' },
        { key: 'share', icon: <SendOutlined />, title: 'ClientHomeStepShare', desc: 'ClientHomeStepShareDesc' },
        { key: 'result', icon: <BarChartOutlined />, title: 'ClientHomeStepResult', desc: 'ClientHomeStepResultDesc' }
      ];

      const statItems = [
        { key: 'total', label: 'ClientHomeStatTotal', onClick: () => navigate('/project') },
        { key: 'open', label: 'ClientHomeStatOpen', tone: 'success', onClick: () => navigate('/project') },
        { key: 'closed', label: 'ClientHomeStatClosed', tone: 'muted', onClick: () => navigate('/project') },
        { key: 'customTemplates', label: 'ClientHomeStatTemplates', tone: 'accent', onClick: () => navigate('/template') }
      ];

      return (
        <Page title={formatMessage({ id: 'ClientAdminHomeTitle' })}>
          <div className={style.home}>
            <section className={style.hero}>
              <div className={style.heroMain}>
                <h2 className={style.heroTitle}>{formatMessage({ id: 'ClientHomeHeroTitle' })}</h2>
                <p className={style.lead}>{formatMessage({ id: 'ClientAdminHomeDescription' })}</p>
                <div className={style.actions}>
                  <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openCreate()}>
                    {formatMessage({ id: 'ClientHomeCreateProject' })}
                  </Button>
                  <Button size="large" onClick={() => navigate('/template')}>
                    {formatMessage({ id: 'ClientHomeGoTemplates' })}
                  </Button>
                </div>
              </div>
              <ol className={style.steps}>
                {steps.map((step, index) => (
                  <li key={step.key} className={style.step}>
                    <span className={style.stepIcon}>{step.icon}</span>
                    <div className={style.stepBody}>
                      <span className={style.stepTitle}>
                        {index + 1}. {formatMessage({ id: step.title })}
                      </span>
                      <span className={style.stepDesc}>{formatMessage({ id: step.desc })}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className={style.stats}>
              {statItems.map(item => (
                <button key={item.key} type="button" className={classnames(style.stat, item.tone && style[`stat-${item.tone}`])} onClick={item.onClick}>
                  <span className={style.statLabel}>{formatMessage({ id: item.label })}</span>
                  {stats ? <span className={style.statValue}>{stats[item.key] == null ? '-' : stats[item.key]}</span> : <Skeleton.Button active size="small" className={style.statSkeleton} />}
                </button>
              ))}
            </section>

            <section className={style.section}>
              <SectionHeader title={formatMessage({ id: 'ClientHomeRecent' })} linkText={formatMessage({ id: 'ClientHomeViewAll' })} onLinkClick={() => navigate('/project')} />
              <BizUnit
                key={refreshKey}
                isNext
                name="questionnaire-home-projects"
                allowKeywordSearch={false}
                apis={{
                  list: {
                    loader: async () => {
                      const { data: resData } = await ajax(Object.assign({}, apis.questionnaire.projectList, { params: { perPage: 4, currentPage: 1 } }));
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
                    name: 'status',
                    title: formatMessage({ id: 'ClientHomeProjectStatus' }),
                    renderType: 'tag',
                    getValueOf: item => ({
                      type: item.status === 'open' ? 'success' : 'default',
                      text: formatMessage({ id: item.status === 'open' ? 'ClientHomeOpen' : 'ClientHomeClosed' })
                    })
                  },
                  {
                    name: 'responseCount',
                    title: formatMessage({ id: 'ClientHomeResponseCount' }),
                    getValueOf: item => String(item.responseCount || 0)
                  },
                  {
                    name: 'updatedAt',
                    title: formatMessage({ id: 'ClientHomeUpdatedAt' }),
                    format: 'datetime'
                  }
                ]}
                getActionList={getActionList}
                options={{
                  bizName: formatMessage({ id: 'ClientHomeRecent' }),
                  tableProps: {
                    pagination: { open: false, pageSize: 4 },
                    renderMobile: renderListCards,
                    renderCard: renderListCards,
                    getScrollContainer: getScrollElement,
                    scrollTopInset: isMobile ? 48 : 0
                  }
                }}
              >
                {renderProps => <TablePageRender {...renderProps} withPage={false} />}
              </BizUnit>
            </section>

            <section className={style.section}>
              <SectionHeader title={formatMessage({ id: 'ClientHomeDefaults' })} hint={formatMessage({ id: 'ClientHomeDefaultsHint' })} linkText={formatMessage({ id: 'ClientHomeAllTemplates' })} onLinkClick={() => navigate('/template')} />
              <div className={style.templates}>
                {templates
                  ? templates.map(item => (
                      <button key={item.id} type="button" className={style.template} onClick={() => openCreate({ templateId: item.id, templateName: item.name, name: item.name, description: item.description })}>
                        <span className={style.templateHead}>
                          <span className={style.templateIcon}>
                            <FileTextOutlined />
                          </span>
                          <span className={classnames(style.templateTag, item.builtinKey && style.templateTagBuiltin)}>{formatMessage({ id: item.builtinKey ? 'QuestionnaireTemplateDefault' : 'QuestionnaireTemplateCustom' })}</span>
                        </span>
                        <span className={style.templateName}>{item.name}</span>
                        <span className={style.templateDesc}>{item.description || formatMessage({ id: 'ClientHomeTemplateNoDescription' })}</span>
                        <span className={style.templateAction}>
                          {formatMessage({ id: 'ClientHomeUseTemplate' })}
                          <RightOutlined />
                        </span>
                      </button>
                    ))
                  : Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className={style.template}>
                        <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 2 }} />
                      </div>
                    ))}
              </div>
            </section>
          </div>
        </Page>
      );
    })
  )
);

export default Home;
