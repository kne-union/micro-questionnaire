import { useMemo } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Flex } from 'antd';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import buildFormCreatorApis from './buildFormCreatorApis';
import AiGenerateButton from './AiGenerateButton';
import schemaLanguages, { normalizeTemplateLanguages } from '../../commons/schemaLanguages';

// 只在支持语言变化时重建 FormCreator：订阅整个 formData 会让编辑器随任意字段变化重新初始化，弹窗会反复跳动。
const SchemaField = ({ FormInfo, FormCreator, defaultSchema, templateApis, ajax }) => {
  const { formatMessage, locale } = useIntl();
  const { formData } = FormInfo.useFormContext();
  const languagesKey = normalizeTemplateLanguages(formData?.languages).join(',');
  const formCreatorApis = useMemo(() => buildFormCreatorApis({ ajax, templateApis, locale }), [ajax, templateApis, locale]);
  const schemaDefaultValue = useMemo(() => defaultSchema(), [defaultSchema]);

  return useMemo(() => {
    const selected = languagesKey.split(',');
    return (
      <FormCreator
        name="schema"
        label={
          <Flex justify="space-between" align="center">
            <span>{formatMessage({ id: 'QuestionnaireSchema' })}</span>
            <AiGenerateButton templateApis={templateApis} />
          </Flex>
        }
        defaultValue={schemaDefaultValue}
        valueKey="id"
        labelKey="name"
        locale={locale}
        languages={schemaLanguages.filter(item => selected.includes(item.value))}
        apis={formCreatorApis}
      />
    );
  }, [FormCreator, formCreatorApis, formatMessage, languagesKey, locale, schemaDefaultValue, templateApis]);
};

const QuestionnaireFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:Global@usePreset', 'components-thirdparty:FormCreator', 'components-thirdparty:FormCreator@defaultSchema']
})(
  withLocale(({ remoteModules, templateApis }) => {
    const [FormInfo, usePreset, FormCreator, defaultSchema] = remoteModules;
    const { Input, TextArea, CheckboxGroup } = FormInfo.fields;
    const { formatMessage, locale } = useIntl();
    const { ajax } = usePreset();
    const languagesDefaultValue = useMemo(() => normalizeTemplateLanguages([locale]), [locale]);
    const languageOptions = useMemo(() => schemaLanguages.map(item => ({ value: item.value, label: formatMessage({ id: item.labelId }) })), [formatMessage]);

    return (
      <FormInfo
        column={1}
        list={[
          <Input key="name" name="name" label={formatMessage({ id: 'QuestionnaireTemplateName' })} rule="REQ LEN-0-100" />,
          <TextArea key="description" name="description" label={formatMessage({ id: 'QuestionnaireTemplateDescription' })} rule="LEN-0-500" />,
          <CheckboxGroup
            key="languages"
            name="languages"
            label={formatMessage({ id: 'QuestionnaireTemplateLanguages' })}
            tips={formatMessage({ id: 'QuestionnaireTemplateLanguagesTip' })}
            rule="REQ"
            defaultValue={languagesDefaultValue}
            options={languageOptions}
          />,
          <SchemaField key="schema" FormInfo={FormInfo} FormCreator={FormCreator} defaultSchema={defaultSchema} templateApis={templateApis} ajax={ajax} />
        ]}
      />
    );
  })
);

export default QuestionnaireFormInner;
