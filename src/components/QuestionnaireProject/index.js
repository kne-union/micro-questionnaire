import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page, useIsMobile, useScrollElement } from '@kne/system-layout';
import { App, Button } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from '@kne/react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import withLocale from '@components/Questionnaire/withLocale';
import { renderListCards } from '@components/Questionnaire/listCards';
import useProjectActions from './useProjectActions';

const imageAccept = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const appearanceData = formData => ({
  background: formData.background || [],
  banners: formData.banners || [],
  themeColor: formData.themeColor || null
});

const appearanceFields = (FormInfo, formatMessage) => {
  const { Upload, ColorPicker } = FormInfo.fields;
  return [
    <ColorPicker key="themeColor" name="themeColor" label={formatMessage({ id: 'QuestionnaireProjectThemeColor' })} />,
    <Upload
      key="background"
      name="background"
      label={formatMessage({ id: 'QuestionnaireProjectBackground' })}
      maxLength={1}
      multiple={false}
      accept={imageAccept}
      fileSize={8}
      block
    />,
    <Upload key="banners" name="banners" label={formatMessage({ id: 'QuestionnaireProjectBanners' })} maxLength={5} accept={imageAccept} fileSize={8} block />
  ];
};

export const ProjectCreateForm = ({ FormInfo, apis, formatMessage, onAddTemplate }) => {
  const { Input, TextArea, RadioGroup, SuperSelect } = FormInfo.fields;
  const { openApi } = FormInfo.useFormContext();

  return (
    <FormInfo
      column={1}
      list={[
        <SuperSelect
          key="templateId"
          name="templateId"
          label={formatMessage({ id: 'QuestionnaireProjectTemplate' })}
          rule="REQ"
          single
          valueKey="id"
          labelKey="name"
          api={Object.assign({}, apis.questionnaire.templateList, {
            params: { perPage: 20, currentPage: 1 }
          })}
          pagination={{ paramsType: 'params' }}
          getSearchProps={({ searchText }) => (searchText ? { keyword: searchText } : {})}
          dataFormat={data => ({
            list: (data?.pageData || []).map(item =>
              Object.assign({}, item, {
                description: [formatMessage({ id: item.builtinKey ? 'QuestionnaireTemplateDefault' : 'QuestionnaireTemplateCustom' }), item.description]
                  .filter(Boolean)
                  .join(' · ')
              })
            ),
            total: data?.totalCount
          })}
          footer={({ close, reload }) => (
            <Button
              type="link"
              block
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                close?.();
                onAddTemplate(reload, openApi);
              }}
            >
              {formatMessage({ id: 'QuestionnaireProjectAddTemplate' })}
            </Button>
          )}
        />,
        <Input key="name" name="name" label={formatMessage({ id: 'QuestionnaireProjectName' })} rule="REQ LEN-0-100" />,
        <TextArea key="description" name="description" label={formatMessage({ id: 'QuestionnaireDescription' })} rule="LEN-0-500" />,
        <RadioGroup
          key="language"
          name="language"
          label={formatMessage({ id: 'QuestionnaireProjectLanguage' })}
          rule="REQ"
          options={[
            { label: formatMessage({ id: 'QuestionnaireProjectLanguageZh' }), value: 'zh-CN' },
            { label: formatMessage({ id: 'QuestionnaireProjectLanguageEn' }), value: 'en-US' },
            { label: formatMessage({ id: 'QuestionnaireProjectLanguageBoth' }), value: 'both' }
          ]}
        />,
        ...appearanceFields(FormInfo, formatMessage)
      ]}
    />
  );
};

const QuestionnaireProject = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-admin:BizUnit@TablePageRender', 'components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:Filter', 'components-core:Modal@useModal']
})(
  withLocale(({ remoteModules }) => {
    const [BizUnit, TablePageRender, usePreset, FormInfo, Filter, useModal] = remoteModules;
    const { SuperSelectFilterItem, DateRangePickerFilterItem } = Filter.fields;
    const { formatMessage } = useIntl();
    const { apis, ajax } = usePreset();
    const formModal = FormInfo.useFormModal();
    const modal = useModal();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const openedPreset = useRef(false);
    const [listKey, setListKey] = useState(0);
    const getScrollElement = useScrollElement();
    const isMobile = useIsMobile();

    const { openCreate, openCreateTemplate, getActionList } = useProjectActions({
      ajax,
      apis,
      formModal,
      modal,
      message,
      formatMessage,
      navigate,
      onChanged: () => setListKey(key => key + 1),
      renderCreateForm: onAddTemplate => <ProjectCreateForm FormInfo={FormInfo} apis={apis} formatMessage={formatMessage} onAddTemplate={onAddTemplate} />
    });

    useEffect(() => {
      if (openedPreset.current || !location.state?.templateId) {
        return;
      }
      openedPreset.current = true;
      const preset = location.state;
      navigate(location.pathname, { replace: true, state: null });
      openCreate(preset);
    }, [location.pathname, location.state, navigate, openCreate]);

    return (
      <BizUnit
        key={listKey}
        isNext
        name="questionnaire-project-list"
        apis={{
          list: apis.questionnaire.projectList,
          create: ({ formData }) =>
            Object.assign({}, apis.questionnaire.projectCreate, {
              data: {
                templateId: formData.templateId?.id || formData.templateId,
                name: formData.name,
                description: formData.description || '',
                language: formData.language || 'both',
                ...appearanceData(formData)
              }
            })
        }}
        getColumns={() => [
          {
            name: 'name',
            title: formatMessage({ id: 'QuestionnaireProjectName' }),
            renderType: 'main',
            onClick: ({ colItem }) => navigate(`/project/${colItem.id}/results`)
          },
          {
            name: 'description',
            title: formatMessage({ id: 'QuestionnaireDescription' }),
            renderType: 'description'
          },
          {
            name: 'language',
            title: formatMessage({ id: 'QuestionnaireProjectLanguage' }),
            getValueOf: item =>
              formatMessage({
                id: item.language === 'zh-CN' ? 'QuestionnaireProjectLanguageZh' : item.language === 'en-US' ? 'QuestionnaireProjectLanguageEn' : 'QuestionnaireProjectLanguageBoth'
              })
          },
          {
            name: 'status',
            title: formatMessage({ id: 'QuestionnaireProjectStatus' }),
            renderType: 'tag',
            getValueOf: item => ({
              type: item.status === 'open' ? 'success' : 'default',
              text: formatMessage({ id: item.status === 'open' ? 'QuestionnaireProjectOpen' : 'QuestionnaireProjectClosed' })
            })
          },
          {
            name: 'responseCount',
            title: formatMessage({ id: 'QuestionnaireProjectResponseCount' }),
            getValueOf: item => item.responseCount || 0
          },
          {
            name: 'updatedAt',
            title: formatMessage({ id: 'QuestionnaireTemplateUpdatedAt' }),
            format: 'datetime'
          }
        ]}
        filter={{
          list: [
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'templateId',
                label: formatMessage({ id: 'QuestionnaireProjectTemplate' }),
                single: true,
                valueKey: 'id',
                labelKey: 'name',
                interceptor: Filter.singleSelectInterceptor,
                api: Object.assign({}, apis.questionnaire.templateList, {
                  params: { perPage: 20, currentPage: 1 }
                }),
                pagination: { paramsType: 'params' },
                getSearchProps: ({ searchText }) => (searchText ? { keyword: searchText } : {})
              }
            },
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'status',
                label: formatMessage({ id: 'QuestionnaireProjectStatus' }),
                single: true,
                valueKey: 'value',
                labelKey: 'label',
                options: [
                  { value: 'open', label: formatMessage({ id: 'QuestionnaireProjectOpen' }) },
                  { value: 'closed', label: formatMessage({ id: 'QuestionnaireProjectClosed' }) }
                ]
              }
            },
            {
              type: DateRangePickerFilterItem,
              props: {
                name: 'updatedAt',
                label: formatMessage({ id: 'QuestionnaireTemplateUpdatedAt' })
              }
            }
          ]
        }}
        getFormInner={() => <ProjectCreateForm FormInfo={FormInfo} apis={apis} formatMessage={formatMessage} onAddTemplate={openCreateTemplate} />}
        getActionList={getActionList}
        options={{
          bizName: formatMessage({ id: 'QuestionnaireProjectTitle' }),
          formSize: 'default',
          keywordFilterName: 'keyword',
          keywordFilterLabel: formatMessage({ id: 'QuestionnaireProjectName' }),
          mapFilterValue: (value, getFilterValue) => {
            const picked = typeof getFilterValue === 'function' ? getFilterValue(value) : {};
            const range = picked.updatedAt;
            return {
              templateId: picked.templateId || null,
              status: picked.status || null,
              updatedAt: Array.isArray(range) && range.length === 2 ? range : null
            };
          },
          createButtonProps: { children: formatMessage({ id: 'QuestionnaireProjectCreate' }), type: 'primary' },
          formProps: { data: { language: 'both' } },
          tableProps: {
            renderMobile: renderListCards,
            renderCard: renderListCards,
            getScrollContainer: getScrollElement,
            scrollTopInset: isMobile ? 48 : 0
          }
        }}
      >
        {renderProps => (
          <Page title={formatMessage({ id: 'QuestionnaireProjectTitle' })}>
            <TablePageRender {...renderProps} withPage={false} />
          </Page>
        )}
      </BizUnit>
    );
  })
);

export default QuestionnaireProject;
