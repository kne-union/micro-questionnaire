const crypto = require('crypto');
const { z } = require('zod');
const { generateObject } = require('ai');
const { createChatModel } = require('./azure-openai');

const FIELD_TYPES = ['Input', 'TextArea', 'InputNumber', 'Switch', 'Checkbox', 'DatePicker', 'Select', 'RadioGroup', 'CheckboxGroup'];
const OPTION_FIELD_TYPES = ['Select', 'RadioGroup', 'CheckboxGroup'];
const MAX_SOURCE_LENGTH = 5000;
const LANGUAGE_NAMES = { 'zh-CN': '简体中文', 'en-US': 'English' };

// schema 文案字段：字符串，或 { 'zh-CN': string, 'en-US': string }
const bilingualCodec = {
  schema: description => z.object({ zh: z.string().describe('Simplified Chinese'), en: z.string().describe('English') }).describe(description),
  to: value => (value && typeof value === 'object' ? { zh: value['zh-CN'] || '', en: value['en-US'] || '' } : { zh: value == null ? '' : String(value), en: '' }),
  from: pair => {
    const zh = String((pair && pair.zh) || '').trim();
    const en = String((pair && pair.en) || '').trim();
    if (zh && en) {
      return { 'zh-CN': zh, 'en-US': en };
    }
    return zh || (en ? { 'en-US': en } : '');
  },
  value: pair => String((pair && (pair.zh || pair.en)) || '').trim()
};

const createSingleCodec = locale => ({
  schema: description => z.string().describe(description),
  to: value => {
    if (value && typeof value === 'object') {
      return value[locale] || value['zh-CN'] || value['en-US'] || '';
    }
    return value == null ? '' : String(value);
  },
  from: value => String(value || '').trim(),
  value: value => String(value || '').trim()
});

const createQuestionnaireSchema = codec =>
  z.object({
    blocks: z
      .array(
        z.object({
          title: codec.schema('Section title'),
          subtitle: codec.schema('Section subtitle, empty if none'),
          column: z.number().describe('Columns of the section: 1 or 2'),
          fields: z.array(
            z.object({
              type: z.enum(FIELD_TYPES),
              name: z.string().describe('Unique English camelCase key of the answer, e.g. expectedSalary'),
              label: codec.schema('Question text shown to the respondent'),
              required: z.boolean(),
              placeholder: codec.schema('Placeholder, empty if none'),
              tips: codec.schema('Extra hint under the question, empty if none'),
              options: z.array(z.object({ label: codec.schema('Option text'), value: z.string() })).describe('Options for Select / RadioGroup / CheckboxGroup; empty array for other types')
            })
          )
        })
      )
      .describe('Questionnaire sections')
  });

const createId = () => crypto.randomUUID();

const toCamelName = value =>
  String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9]+(.)?/g, (match, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^[^A-Za-z]+/, '')
    .replace(/^./, chr => chr.toLowerCase());

const createNameAllocator = () => {
  const used = new Set();
  return value => {
    const base = toCamelName(value);
    let name = base;
    let index = 1;
    while (!name || used.has(name)) {
      name = `${base || 'q'}${index}`;
      index += 1;
    }
    used.add(name);
    return name;
  };
};

const isFormInfoBlock = block => block && (block.kind === 'formInfo' || !block.kind);

const blockToSimple = (block, codec) => ({
  title: codec.to(block.title),
  subtitle: codec.to(block.subtitle),
  column: block.column || 1,
  fields: (block.list || [])
    .filter(field => field && field.name)
    .map(field => ({
      type: field.type,
      name: field.name,
      label: codec.to(field.label),
      required: /\bREQ\b/.test(field.rule || ''),
      placeholder: codec.to(field.props?.placeholder),
      tips: codec.to(field.tips),
      options: Array.isArray(field.props?.options) ? field.props.options.map(item => ({ label: codec.to(item?.label), value: item?.value })) : []
    }))
});

const normalizeOptions = (options, codec) =>
  (options || [])
    .map(item => ({ label: codec.from(item?.label), value: String(item?.value || codec.value(item?.label)).trim() }))
    .filter(item => item.label && item.value)
    .filter((item, index, list) => list.findIndex(other => other.value === item.value) === index);

const normalizeField = (field, allocateName, codec) => {
  const options = normalizeOptions(field.options, codec);
  let type = FIELD_TYPES.includes(field.type) ? field.type : 'Input';
  if (OPTION_FIELD_TYPES.includes(type) && !options.length) {
    type = 'Input';
  }
  const props = {};
  const placeholder = codec.from(field.placeholder);
  if (placeholder) {
    props.placeholder = placeholder;
  }
  if (OPTION_FIELD_TYPES.includes(type)) {
    props.options = options;
  }
  const tips = codec.from(field.tips);
  return Object.assign(
    {
      id: createId(),
      type,
      name: allocateName(field.name),
      label: codec.from(field.label),
      props
    },
    field.required ? { rule: 'REQ' } : {},
    tips ? { tips } : {},
    type === 'TextArea' ? { block: true } : {}
  );
};

const normalizeBlock = (block, allocateName, codec) => {
  const subtitle = codec.from(block.subtitle);
  return Object.assign(
    {
      id: createId(),
      kind: 'formInfo',
      title: codec.from(block.title),
      column: Number(block.column) === 2 ? 2 : 1,
      list: (block.fields || []).filter(field => field && codec.value(field.label)).map(field => normalizeField(field, allocateName, codec))
    },
    subtitle ? { subtitle } : {}
  );
};

const BILINGUAL_SECTION = `## 输出语言
问卷需同时提供中英文：title / subtitle / label / placeholder / tips / 选项 label 都以 { zh, en } 给出，zh 为简体中文，en 为对应的自然英文表达，两者含义一致。
已有问卷中 en 为空的文案，请补全英文翻译。无内容的 subtitle / placeholder / tips 的 zh、en 都返回空字符串。
`;

const buildSingleSection = locale => `## 输出语言
问卷只使用${LANGUAGE_NAMES[locale]}：title / subtitle / label / placeholder / tips / 选项 label 都是${LANGUAGE_NAMES[locale]}字符串，不要附带其他语言的翻译。
已有问卷中非${LANGUAGE_NAMES[locale]}的文案，请改写为${LANGUAGE_NAMES[locale]}。无内容的 subtitle / placeholder / tips 返回空字符串。
`;

const RULES = `## 规则
1. 根据用户描述的场景设计问卷，问题要具体、可回答，并与场景直接相关。
2. 按主题拆分为若干 section（blocks），每个 section 3-8 道题为宜；column 默认 1，简短字段多时可用 2。
3. 题型 type 只能用：${FIELD_TYPES.join(' / ')}。单选用 RadioGroup（选项少）或 Select（选项多），多选用 CheckboxGroup，长文本用 TextArea，数字用 InputNumber，日期用 DatePicker，是/否用 Switch。
4. Select / RadioGroup / CheckboxGroup 必须提供 options（label 为展示文案，value 为英文小写短标识）；其他题型 options 为空数组。
5. name 是答案的存储键：英文 camelCase、全问卷唯一、语义化。
6. 关键必答题 required 为 true。`;

const buildPrompt = ({ source, currentBlocks, languageSection }) => {
  const modifySection = currentBlocks.length
    ? `## 当前问卷（必须在此基础上修改）
用户正在编辑已有问卷。请根据下方「修改指令」调整，不要从零重写：
- 未提及的 section 与题目保持原样（包括 name、题型、选项、必填）
- 只按指令增删改对应内容
- 返回修改后的完整问卷

当前问卷：
${JSON.stringify({ blocks: currentBlocks }, null, 2)}

`
    : '你是问卷设计专家，请根据用户描述的场景设计一份问卷。\n\n';

  return `${modifySection}${languageSection}
${RULES}

${currentBlocks.length ? '修改指令' : '用户描述'}：
"""
${source}
"""`;
};

const generateQuestionnaireSchema = async (fastify, { source, currentSchema, languages, locale }) => {
  const text = String(source || '').trim();
  if (!text) {
    throw new Error('请填写问卷场景描述');
  }
  if (text.length > MAX_SOURCE_LENGTH) {
    throw new Error('描述过长');
  }

  const selected = Object.keys(LANGUAGE_NAMES).filter(item => Array.isArray(languages) && languages.includes(item));
  const multilingual = selected.length > 1;
  const language = selected[0] || (LANGUAGE_NAMES[locale] ? locale : 'zh-CN');
  const codec = multilingual ? bilingualCodec : createSingleCodec(language);
  const currentBlocks = Array.isArray(currentSchema?.blocks) ? currentSchema.blocks : [];
  const formInfoBlocks = currentBlocks.filter(isFormInfoBlock);
  const otherBlocks = currentBlocks.filter(block => !isFormInfoBlock(block));

  const { object } = await generateObject({
    model: createChatModel(fastify.config),
    schema: createQuestionnaireSchema(codec),
    prompt: buildPrompt({
      source: text,
      currentBlocks: formInfoBlocks.map(block => blockToSimple(block, codec)).filter(block => block.fields.length),
      languageSection: multilingual ? BILINGUAL_SECTION : buildSingleSection(language)
    }),
    maxOutputTokens: 8000
  });

  const allocateName = createNameAllocator();
  const blocks = (object?.blocks || []).map(block => normalizeBlock(block, allocateName, codec)).filter(block => block.list.length);
  if (!blocks.length) {
    throw new Error('AI 没有生成有效题目');
  }

  return Object.assign({}, currentSchema && typeof currentSchema === 'object' ? currentSchema : {}, {
    blocks: [...blocks, ...otherBlocks]
  });
};

module.exports = {
  generateQuestionnaireSchema
};
