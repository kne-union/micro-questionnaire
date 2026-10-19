import { createWithRemoteLoader } from '@kne/remote-loader';
import { App, Button } from 'antd';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import AiGenerateFormInner from './AiGenerateFormInner';

const hasFields = schema => (schema?.blocks || []).some(block => (block?.list || []).length > 0);

const AiGenerateButton = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, templateApis, name = 'schema' }) => {
    const [FormInfo, usePreset] = remoteModules;
    const { openApi } = FormInfo.useFormContext();
    const formModal = FormInfo.useFormModal();
    const { ajax } = usePreset();
    const { formatMessage, locale } = useIntl();
    const { message } = App.useApp();

    const handleClick = () => {
      const schema = openApi.getFormData()?.[name];
      const isModifyMode = hasFields(schema);
      formModal({
        title: formatMessage({ id: 'QuestionnaireAiGenerate' }),
        saveText: formatMessage({ id: 'QuestionnaireAiGenerateSubmit' }),
        children: <AiGenerateFormInner isModifyMode={isModifyMode} />,
        formProps: {
          onSubmit: async formData => {
            const { data: resData } = await ajax(
              Object.assign({}, templateApis.templateGenerate, {
                data: {
                  source: formData.source,
                  locale: locale === 'zh-CN' ? 'zh-CN' : 'en-US',
                  currentSchema: isModifyMode ? schema : undefined
                }
              })
            );
            if (resData.code !== 0) {
              return false;
            }
            openApi.setField({ name, value: resData.data });
            message.success(formatMessage({ id: 'QuestionnaireAiGenerateSuccess' }));
          }
        }
      });
    };

    return (
      <Button size="small" shape="round" onClick={handleClick}>
        {formatMessage({ id: 'QuestionnaireAiGenerate' })}
      </Button>
    );
  })
);

export default AiGenerateButton;
