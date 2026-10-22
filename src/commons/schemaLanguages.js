/** 问卷 schema 文案支持的语言，首项为基础语言；与服务端 pickText 的回退顺序保持一致 */
const schemaLanguages = [
  { value: 'zh-CN', label: '中文', labelId: 'QuestionnaireLanguageZh' },
  { value: 'en-US', label: 'English', labelId: 'QuestionnaireLanguageEn' }
];

/** 模版支持的语言：按 schemaLanguages 顺序去重过滤，空时回退中文 */
export const normalizeTemplateLanguages = value => {
  const list = Array.isArray(value) ? value : [];
  const result = schemaLanguages.map(item => item.value).filter(item => list.includes(item));
  return result.length ? result : [schemaLanguages[0].value];
};

/** 普通字符串原样返回；多语言对象按 locale → zh-CN → en-US 回退 */
export const pickLocaleText = (value, locale) => {
  if (value && typeof value === 'object') {
    return value[locale] || value['zh-CN'] || value['en-US'] || '';
  }
  return value == null ? '' : String(value);
};

/** 模版支持双语且填写语言为 both 时，名称/说明需中英两份 */
export const isProjectBilingual = (templateLanguages, fillLanguage) => {
  const langs = normalizeTemplateLanguages(templateLanguages);
  return fillLanguage === 'both' && langs.includes('zh-CN') && langs.includes('en-US');
};

/** 根据模版支持语言决定项目默认填写语言 */
export const defaultProjectLanguage = templateLanguages => {
  const langs = normalizeTemplateLanguages(templateLanguages);
  return langs.length > 1 ? 'both' : langs[0];
};

/** 根据模版支持语言过滤填写语言选项 */
export const projectLanguageValues = templateLanguages => {
  const langs = normalizeTemplateLanguages(templateLanguages);
  const values = langs.slice();
  if (langs.includes('zh-CN') && langs.includes('en-US')) {
    values.push('both');
  }
  return values;
};

/** 表单提交：both 时合并中英字段，否则取单语字符串 */
export const packProjectText = (formData, language, field) => {
  if (language === 'both') {
    return {
      'zh-CN': String(formData[field] || '').trim(),
      'en-US': String(formData[`${field}EnUS`] || '').trim()
    };
  }
  return String(formData[field] || '').trim();
};

/** 编辑回填：多语言拆成 name / nameEnUS */
export const unpackProjectText = (value, language) => {
  if (language === 'both' && value && typeof value === 'object') {
    return { primary: value['zh-CN'] || '', secondary: value['en-US'] || '' };
  }
  if (value && typeof value === 'object') {
    return { primary: pickLocaleText(value, language === 'en-US' ? 'en-US' : 'zh-CN'), secondary: '' };
  }
  return { primary: value == null ? '' : String(value), secondary: '' };
};

export default schemaLanguages;
