import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';

const AiGenerateFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, isModifyMode }) => {
    const [FormInfo] = remoteModules;
    const { TextArea } = FormInfo.fields;
    const { formatMessage } = useIntl();
    return (
      <FormInfo
        column={1}
        list={[
          <TextArea
            name="source"
            label={formatMessage({ id: isModifyMode ? 'QuestionnaireAiModifySource' : 'QuestionnaireAiSource' })}
            rule="REQ LEN-1-5000"
            placeholder={formatMessage({ id: isModifyMode ? 'QuestionnaireAiModifySourcePlaceholder' : 'QuestionnaireAiSourcePlaceholder' })}
            autoSize={{ minRows: 12, maxRows: 20 }}
            block
          />
        ]}
      />
    );
  })
);

export default AiGenerateFormInner;
