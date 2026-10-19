import { useMemo } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Flex } from 'antd';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import buildFormCreatorApis from './buildFormCreatorApis';
import AiGenerateButton from './AiGenerateButton';

const QuestionnaireFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:Global@usePreset', 'components-thirdparty:FormCreator', 'components-thirdparty:FormCreator@defaultSchema']
})(
  withLocale(({ remoteModules, templateApis }) => {
    const [FormInfo, usePreset, FormCreator, defaultSchema] = remoteModules;
    const { Input, TextArea } = FormInfo.fields;
    const { formatMessage, locale } = useIntl();
    const { ajax } = usePreset();
    const formCreatorApis = useMemo(() => buildFormCreatorApis({ ajax, templateApis }), [ajax, templateApis]);

    return (
      <FormInfo
        column={1}
        list={[
          <Input key="name" name="name" label={formatMessage({ id: 'QuestionnaireTemplateName' })} rule="REQ LEN-0-100" />,
          <TextArea key="description" name="description" label={formatMessage({ id: 'QuestionnaireTemplateDescription' })} rule="LEN-0-500" />,
          <FormCreator
            key="schema"
            name="schema"
            label={
              <Flex justify="space-between" align="center">
                <span>{formatMessage({ id: 'QuestionnaireSchema' })}</span>
                <AiGenerateButton templateApis={templateApis} />
              </Flex>
            }
            defaultValue={defaultSchema()}
            valueKey="id"
            labelKey="name"
            locale={locale}
            apis={formCreatorApis}
          />
        ]}
      />
    );
  })
);

export default QuestionnaireFormInner;
