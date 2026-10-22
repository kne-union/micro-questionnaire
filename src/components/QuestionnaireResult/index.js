import { createWithRemoteLoader } from '@kne/remote-loader';
import { Page, useIsMobile, useScrollElement } from '@kne/system-layout';
import { App, Button, Modal } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useIntl } from '@kne/react-intl';
import withLocale from '@components/Questionnaire/withLocale';
import { renderListCards } from '@components/Questionnaire/listCards';
import schemaLanguages from '../../commons/schemaLanguages';

const flattenFields = schema =>
  (schema?.blocks || []).flatMap(block => {
    if (block?.kind && block.kind !== 'formInfo') {
      return [];
    }
    const title = block?.title ? `${block.title}-` : '';
    return (block?.list || [])
      .filter(field => field && field.name && !field.hidden)
      .map(field => ({
        name: field.name,
        label: `${title}${field.label || field.name}`,
        options: field.props?.options
      }));
  });

const formatAnswer = (field, value) => {
  if (value == null || value === '') {
    return '';
  }
  if (Array.isArray(field.options) && field.options.length) {
    const values = Array.isArray(value) ? value : [value];
    return values
      .map(item => field.options.find(option => option.value === item)?.label || item)
      .filter(item => item != null && item !== '')
      .join('、');
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (Array.isArray(value)) {
    return value.map(item => (item && typeof item === 'object' ? JSON.stringify(item) : String(item))).join('、');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

const QuestionnaireResult = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-admin:BizUnit@TablePageRender', 'components-core:Global@usePreset', 'components-thirdparty:FormCreator@SchemaContent', 'components-thirdparty:FormCreator@localizeSchema']
})(
  withLocale(({ remoteModules }) => {
    const [BizUnit, TablePageRender, usePreset, SchemaContent, localizeSchema] = remoteModules;
    const getScrollElement = useScrollElement();
    const isMobile = useIsMobile();
    const { formatMessage, locale } = useIntl();
    const { ajax, apis } = usePreset();
    const { message } = App.useApp();
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [current, setCurrent] = useState(null);

    useEffect(() => {
      let cancelled = false;
      ajax(Object.assign({}, apis.questionnaire.projectDetail, { params: { id } })).then(({ data: resData }) => {
        if (!cancelled && resData.code === 0) {
          setProject(resData.data);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [ajax, apis.questionnaire.projectDetail, id]);

    const fields = useMemo(() => flattenFields(localizeSchema(project?.schema, locale, schemaLanguages)), [localizeSchema, project, locale]);

    const download = async () => {
      try {
        const { data } = await ajax(
          Object.assign({}, apis.questionnaire.projectExport, {
            params: { id, locale },
            responseType: 'blob'
          })
        );
        const blob = data instanceof Blob ? data : new Blob([data]);
        if (blob.type.indexOf('application/json') > -1) {
          const resData = JSON.parse(await blob.text());
          message.error(resData.msg || formatMessage({ id: 'QuestionnaireResultDownloadFailed' }));
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${project?.name || 'questionnaire'}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        message.error(error.message || formatMessage({ id: 'QuestionnaireResultDownloadFailed' }));
      }
    };

    return (
      <BizUnit
        isNext
        name="questionnaire-response-list"
        allowKeywordSearch={false}
        apis={{
          list: Object.assign({}, apis.questionnaire.responseList, {
            params: { id }
          })
        }}
        getColumns={() => [
          {
            name: 'submittedAt',
            title: formatMessage({ id: 'QuestionnaireResultSubmittedAt' }),
            renderType: 'main',
            format: 'datetime',
            onClick: ({ colItem }) => setCurrent(colItem)
          },
          ...fields.map(field => ({
            name: field.name,
            title: field.label,
            getValueOf: item => formatAnswer(field, item.answers?.[field.name])
          }))
        ]}
        getActionList={({ data, ...actionProps }) => [
          {
            ...actionProps,
            data,
            children: formatMessage({ id: 'QuestionnaireResultView' }),
            onClick: () => setCurrent(data)
          }
        ]}
        titleExtra={
          <Button type="primary" onClick={download}>
            {formatMessage({ id: 'QuestionnaireResultDownload' })}
          </Button>
        }
        options={{
          bizName: formatMessage({ id: 'QuestionnaireResultTitle' }),
          tableProps: {
            renderMobile: renderListCards,
            renderCard: renderListCards,
            getScrollContainer: getScrollElement,
            scrollTopInset: isMobile ? 48 : 0
          }
        }}
      >
        {renderProps => (
          <Page title={project?.name || formatMessage({ id: 'QuestionnaireResultTitle' })} back>
            <TablePageRender {...renderProps} withPage={false} />
            <Modal open={!!current} title={formatMessage({ id: 'QuestionnaireResultView' })} footer={null} width={760} onCancel={() => setCurrent(null)} destroyOnClose>
              {current && project ? <SchemaContent locale={locale} languages={schemaLanguages} schema={project.schema} data={current.answers || {}} /> : null}
            </Modal>
          </Page>
        )}
      </BizUnit>
    );
  })
);

export default QuestionnaireResult;
