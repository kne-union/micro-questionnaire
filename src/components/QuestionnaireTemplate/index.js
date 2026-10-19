import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page, useIsMobile, useScrollElement } from '@kne/system-layout';
import { App } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from '@kne/react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import withLocale from '@components/Questionnaire/withLocale';
import QuestionnaireFormInner from '@components/Questionnaire/QuestionnaireFormInner';
import { renderListCards } from '@components/Questionnaire/listCards';
import { ProjectCreateForm } from '@components/QuestionnaireProject';

const QuestionnaireTemplate = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-admin:BizUnit@TablePageRender', 'components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:Filter']
})(
  withLocale(({ remoteModules }) => {
    const [BizUnit, TablePageRender, usePreset, FormInfo, Filter] = remoteModules;
    const { SuperSelectFilterItem } = Filter.fields;
    const { formatMessage } = useIntl();
    const { apis, ajax } = usePreset();
    const { message } = App.useApp();
    const formModal = FormInfo.useFormModal();
    const navigate = useNavigate();
    const location = useLocation();
    const openedPreset = useRef(false);
    const [listKey, setListKey] = useState(0);
    const getScrollElement = useScrollElement();
    const isMobile = useIsMobile();
    const templateApis = apis.questionnaire;

    const openTemplate = item => {
      formModal({
        title: formatMessage({ id: 'QuestionnaireTemplateEdit' }),
        size: 'large',
        formProps: {
          data: { name: item.name, description: item.description, schema: item.schema },
          onSubmit: async formData => {
            const { data: resData } = await ajax(
              Object.assign({}, templateApis.templateSave, {
                data: {
                  id: item.id,
                  name: formData.name,
                  description: formData.description || '',
                  schema: formData.schema
                }
              })
            );
            if (resData.code !== 0) {
              return false;
            }
            message.success(formatMessage({ id: 'QuestionnaireTemplateSaveSuccess' }));
            setListKey(key => key + 1);
          }
        },
        children: <QuestionnaireFormInner templateApis={templateApis} />
      });
    };

    const openCreateTemplate = (reloadList, openApi) => {
      formModal({
        title: formatMessage({ id: 'QuestionnaireTemplateCreate' }),
        size: 'large',
        formProps: {
          onSubmit: async formData => {
            const { data: resData } = await ajax(
              Object.assign({}, templateApis.templateSave, {
                data: {
                  name: formData.name,
                  description: formData.description || '',
                  schema: formData.schema
                }
              })
            );
            if (resData.code !== 0) {
              return false;
            }
            const created = resData.data || {};
            const fields = [{ name: 'templateId', value: created }];
            if (!openApi.formData?.name && created.name) {
              fields.push({ name: 'name', value: created.name });
            }
            if (!openApi.formData?.description && created.description) {
              fields.push({ name: 'description', value: created.description });
            }
            openApi.setFields(fields);
            reloadList();
            setListKey(key => key + 1);
            message.success(formatMessage({ id: 'QuestionnaireTemplateCreateSuccess' }));
          }
        },
        children: <QuestionnaireFormInner templateApis={templateApis} />
      });
    };

    const openCreateProject = preset => {
      formModal({
        title: formatMessage({ id: 'QuestionnaireProjectCreate' }),
        size: 'default',
        formProps: {
          data: {
            language: 'both',
            templateId: { id: preset.templateId, name: preset.name || '' },
            name: preset.name || '',
            description: preset.description || ''
          },
          onSubmit: async formData => {
            const templateId = formData.templateId?.id || formData.templateId;
            const { data: saveData } = await ajax(
              Object.assign({}, templateApis.projectCreate, {
                data: {
                  templateId,
                  name: formData.name,
                  description: formData.description || '',
                  language: formData.language || 'both',
                  background: formData.background || [],
                  banners: formData.banners || [],
                  themeColor: formData.themeColor || null
                }
              })
            );
            if (saveData.code !== 0) {
              return false;
            }
            message.success(formatMessage({ id: 'QuestionnaireProjectCreateSuccess' }));
            navigate('/project');
          }
        },
        children: <ProjectCreateForm FormInfo={FormInfo} apis={apis} formatMessage={formatMessage} onAddTemplate={openCreateTemplate} />
      });
    };

    useEffect(() => {
      if (openedPreset.current || !location.state?.templateId) {
        return;
      }
      openedPreset.current = true;
      const preset = location.state;
      navigate(location.pathname, { replace: true, state: null });
      openCreateProject(preset);
    }, [location.pathname, location.state, navigate]);

    return (
      <BizUnit
        key={listKey}
        isNext
        name="questionnaire-template-list"
        apis={{
          list: templateApis.templateList,
          create: ({ formData }) =>
            Object.assign({}, templateApis.templateSave, {
              data: {
                name: formData.name,
                description: formData.description || '',
                schema: formData.schema
              }
            }),
          save: ({ formData, data }) =>
            Object.assign({}, templateApis.templateSave, {
              data: {
                id: data.id,
                name: formData.name,
                description: formData.description || '',
                schema: formData.schema
              }
            }),
          remove: templateApis.templateRemove
        }}
        getColumns={() => [
          {
            name: 'name',
            title: formatMessage({ id: 'QuestionnaireTemplateName' }),
            renderType: 'main',
            onClick: ({ colItem }) => openTemplate(colItem)
          },
          {
            name: 'builtinKey',
            title: formatMessage({ id: 'QuestionnaireTemplateKind' }),
            renderType: 'tag',
            getValueOf: item => ({
              type: item.builtinKey ? 'processing' : 'default',
              text: formatMessage({ id: item.builtinKey ? 'QuestionnaireTemplateDefault' : 'QuestionnaireTemplateCustom' })
            })
          },
          {
            name: 'description',
            title: formatMessage({ id: 'QuestionnaireTemplateDescription' }),
            renderType: 'description'
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
                name: 'kind',
                label: formatMessage({ id: 'QuestionnaireTemplateKind' }),
                single: true,
                valueKey: 'value',
                labelKey: 'label',
                options: [
                  { value: 'builtin', label: formatMessage({ id: 'QuestionnaireTemplateDefault' }) },
                  { value: 'custom', label: formatMessage({ id: 'QuestionnaireTemplateCustom' }) }
                ]
              }
            }
          ]
        }}
        getFormInner={() => <QuestionnaireFormInner templateApis={templateApis} />}
        getActionList={({ data, ...actionProps }) => [
          {
            ...actionProps,
            data,
            children: formatMessage({ id: 'QuestionnaireTemplateCreateProject' }),
            onClick: () =>
              openCreateProject({
                templateId: data.id,
                name: data.name,
                description: data.description
              })
          },
          {
            name: 'save',
            reset: item => Object.assign({}, item, { hidden: !!data.builtinKey })
          },
          {
            name: 'remove',
            reset: item => Object.assign({}, item, { hidden: !!data.builtinKey })
          }
        ]}
        options={{
          bizName: formatMessage({ id: 'QuestionnaireTemplateTitle' }),
          formSize: 'large',
          keywordFilterName: 'keyword',
          keywordFilterLabel: formatMessage({ id: 'QuestionnaireTemplateName' }),
          mapFilterValue: (value, getFilterValue) => {
            const picked = typeof getFilterValue === 'function' ? getFilterValue(value) : {};
            return { kind: picked.kind || null };
          },
          createButtonProps: { children: formatMessage({ id: 'QuestionnaireTemplateCreate' }), type: 'primary' },
          editButtonProps: { children: formatMessage({ id: 'QuestionnaireTemplateEdit' }) },
          removeButtonProps: { children: formatMessage({ id: 'QuestionnaireTemplateDelete' }) },
          removeMessage: formatMessage({ id: 'QuestionnaireTemplateDeleteConfirm' }),
          tableProps: {
            renderMobile: renderListCards,
            renderCard: renderListCards,
            getScrollContainer: getScrollElement,
            scrollTopInset: isMobile ? 48 : 0
          }
        }}
      >
        {renderProps => (
          <Page title={formatMessage({ id: 'QuestionnaireTemplateTitle' })}>
            <TablePageRender {...renderProps} withPage={false} />
          </Page>
        )}
      </BizUnit>
    );
  })
);

export default QuestionnaireTemplate;
