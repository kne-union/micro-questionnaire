const crypto = require('crypto');
const { z } = require('zod');
const { generateObject } = require('ai');
const { createChatModel } = require('./azure-openai');

const FIELD_TYPES = ['Input', 'TextArea', 'InputNumber', 'Switch', 'Checkbox', 'DatePicker', 'Select', 'RadioGroup', 'CheckboxGroup'];
const OPTION_FIELD_TYPES = ['Select', 'RadioGroup', 'CheckboxGroup'];
const MAX_SOURCE_LENGTH = 5000;

const questionnaireSchema = z.object({
  blocks: z
    .array(
      z.object({
        title: z.string().describe('Section title'),
        subtitle: z.string().describe('Section subtitle, empty string if none'),
        column: z.number().describe('Columns of the section: 1 or 2'),
        fields: z.array(
          z.object({
            type: z.enum(FIELD_TYPES),
            name: z.string().describe('Unique English camelCase key of the answer, e.g. expectedSalary'),
            label: z.string().describe('Question text shown to the respondent'),
            required: z.boolean(),
            placeholder: z.string().describe('Placeholder, empty string if none'),
            tips: z.string().describe('Extra hint under the question, empty string if none'),
            options: z.array(z.object({ label: z.string(), value: z.string() })).describe('Options for Select / RadioGroup / CheckboxGroup; empty array for other types')
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

const blockToSimple = block => ({
  title: block.title || '',
  subtitle: block.subtitle || '',
  column: block.column || 1,
  fields: (block.list || [])
    .filter(field => field && field.name)
    .map(field => ({
      type: field.type,
      name: field.name,
      label: field.label || '',
      required: /\bREQ\b/.test(field.rule || ''),
      placeholder: field.props?.placeholder || '',
      tips: field.tips || '',
      options: Array.isArray(field.props?.options) ? field.props.options : []
    }))
});

const normalizeOptions = options =>
  (options || [])
    .map(item => ({ label: String(item?.label || '').trim(), value: String(item?.value || item?.label || '').trim() }))
    .filter(item => item.label && item.value)
    .filter((item, index, list) => list.findIndex(other => other.value === item.value) === index);

const normalizeField = (field, allocateName) => {
  const options = normalizeOptions(field.options);
  let type = FIELD_TYPES.includes(field.type) ? field.type : 'Input';
  if (OPTION_FIELD_TYPES.includes(type) && !options.length) {
    type = 'Input';
  }
  const props = {};
  const placeholder = String(field.placeholder || '').trim();
  if (placeholder) {
    props.placeholder = placeholder;
  }
  if (OPTION_FIELD_TYPES.includes(type)) {
    props.options = options;
  }
  const tips = String(field.tips || '').trim();
  return Object.assign(
    {
      id: createId(),
      type,
      name: allocateName(field.name),
      label: String(field.label || '').trim(),
      props
    },
    field.required ? { rule: 'REQ' } : {},
    tips ? { tips } : {},
    type === 'TextArea' ? { block: true } : {}
  );
};

const normalizeBlock = (block, allocateName) => {
  const subtitle = String(block.subtitle || '').trim();
  return Object.assign(
    {
      id: createId(),
      kind: 'formInfo',
      title: String(block.title || '').trim(),
      column: Number(block.column) === 2 ? 2 : 1,
      list: (block.fields || []).filter(field => field && String(field.label || '').trim()).map(field => normalizeField(field, allocateName))
    },
    subtitle ? { subtitle } : {}
  );
};

const buildLocaleSection = locale =>
  locale === 'en-US' ? '## Output Language\nAll titles, questions, placeholders, tips and option labels must be in **English**.\n' : '## 输出语言\n所有标题、题目、placeholder、提示与选项文案使用**简体中文**。\n';

const RULES = `## 规则
1. 根据用户描述的场景设计问卷，问题要具体、可回答，并与场景直接相关。
2. 按主题拆分为若干 section（blocks），每个 section 3-8 道题为宜；column 默认 1，简短字段多时可用 2。
3. 题型 type 只能用：${FIELD_TYPES.join(' / ')}。单选用 RadioGroup（选项少）或 Select（选项多），多选用 CheckboxGroup，长文本用 TextArea，数字用 InputNumber，日期用 DatePicker，是/否用 Switch。
4. Select / RadioGroup / CheckboxGroup 必须提供 options（label 为展示文案，value 为英文小写短标识）；其他题型 options 为空数组。
5. name 是答案的存储键：英文 camelCase、全问卷唯一、语义化。
6. 关键必答题 required 为 true。无内容的 subtitle / placeholder / tips 返回空字符串。`;

const buildPrompt = ({ source, locale, currentBlocks }) => {
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

  return `${modifySection}${buildLocaleSection(locale)}
${RULES}

${currentBlocks.length ? '修改指令' : '用户描述'}：
"""
${source}
"""`;
};

const generateQuestionnaireSchema = async (fastify, { source, locale, currentSchema }) => {
  const text = String(source || '').trim();
  if (!text) {
    throw new Error('请填写问卷场景描述');
  }
  if (text.length > MAX_SOURCE_LENGTH) {
    throw new Error('描述过长');
  }

  const currentBlocks = Array.isArray(currentSchema?.blocks) ? currentSchema.blocks : [];
  const formInfoBlocks = currentBlocks.filter(isFormInfoBlock);
  const otherBlocks = currentBlocks.filter(block => !isFormInfoBlock(block));

  const { object } = await generateObject({
    model: createChatModel(fastify.config),
    schema: questionnaireSchema,
    prompt: buildPrompt({
      source: text,
      locale: locale === 'en-US' ? 'en-US' : 'zh-CN',
      currentBlocks: formInfoBlocks.map(blockToSimple).filter(block => block.fields.length)
    }),
    maxOutputTokens: 8000
  });

  const allocateName = createNameAllocator();
  const blocks = (object?.blocks || []).map(block => normalizeBlock(block, allocateName)).filter(block => block.list.length);
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
