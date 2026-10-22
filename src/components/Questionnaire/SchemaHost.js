import { createWithRemoteLoader } from '@kne/remote-loader';
import { useEffect, useMemo, useRef } from 'react';
import schemaLanguages from '../../commons/schemaLanguages';

const DraftKeeper = ({ useFormContext, draftRef }) => {
  const formData = useFormContext()?.formData;
  useEffect(() => {
    if (formData) {
      draftRef.current = formData;
    }
  }, [draftRef, formData]);
  return null;
};

// SchemaRenderer 只在挂载时读取 locale，切换语言需重新挂载；用已填内容作为初始值，避免切换后清空答案。
// 远程 SchemaRenderer 内部取的是全局 locale，传入的 locale 不生效，所以先按当前语言解析好多语言文案再渲染。
const SchemaHost = createWithRemoteLoader({
  modules: ['components-thirdparty:FormCreator@SchemaRenderer', 'components-thirdparty:FormCreator@localizeSchema', 'components-core:FormInfo']
})(({ remoteModules, locale, schema, onSubmit }) => {
  const [SchemaRenderer, localizeSchema, FormInfo] = remoteModules;
  const draftRef = useRef({});
  const localizedSchema = useMemo(() => localizeSchema(schema, locale, schemaLanguages), [localizeSchema, schema, locale]);
  return (
    <SchemaRenderer key={locale} locale={locale} languages={schemaLanguages} schema={localizedSchema} formProps={{ data: draftRef.current, onSubmit }}>
      <DraftKeeper useFormContext={FormInfo.useFormContext} draftRef={draftRef} />
    </SchemaRenderer>
  );
});

export default SchemaHost;
