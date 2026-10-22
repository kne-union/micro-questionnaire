const t = (zh, en) => ({ 'zh-CN': zh, 'en-US': en });

const option = (label, value) => ({ label, value, description: '' });

const field = (name, label, type, extra = {}) => ({
  id: `field_${name}`,
  type,
  name,
  label,
  tips: '',
  description: '',
  rule: extra.rule || '',
  block: type === 'TextArea' || type === 'RadioGroup' || type === 'CheckboxGroup',
  hidden: false,
  props: Object.assign(
    {},
    type === 'TextArea' ? { rows: 3, placeholder: extra.placeholder || '' } : {},
    type === 'Input' ? { allowClear: true, placeholder: extra.placeholder || '' } : {},
    type === 'RadioGroup' || type === 'CheckboxGroup' ? { inline: true, options: extra.options || [] } : {}
  )
});

const schema = (key, title, fields) => ({
  title,
  subtitle: '',
  column: 1,
  gap: 24,
  blocks: [
    {
      id: `block_${key}`,
      kind: 'formInfo',
      title,
      subtitle: '',
      column: 1,
      gap: 24,
      bordered: false,
      important: false,
      showIndex: false,
      name: '',
      label: '',
      list: fields,
      items: [],
      itemBlocks: [],
      blocks: [],
      options: []
    }
  ],
  actions: {
    showSubmit: true,
    showReset: false,
    showCancel: false,
    submitText: t('提交', 'Submit'),
    resetText: '',
    cancelText: '',
    align: 'center',
    gap: 16
  }
});

const DEFAULT_TEMPLATES = [
  {
    key: 'event-registration',
    name: t('活动报名', 'Event Registration'),
    description: t('收集报名人的联系方式、公司和到场需求。', 'Collect attendees\' contact details, company and on-site needs.'),
    schema: schema('event-registration', t('活动报名', 'Event Registration'), [
      field('name', t('姓名', 'Name'), 'Input', { rule: 'REQ', placeholder: t('请输入姓名', 'Enter your name') }),
      field('mobile', t('手机号', 'Mobile'), 'Input', { rule: 'REQ', placeholder: t('请输入手机号', 'Enter your mobile number') }),
      field('company', t('公司', 'Company'), 'Input', { placeholder: t('请输入公司名称', 'Enter your company name') }),
      field('title', t('职位', 'Job Title'), 'Input', { placeholder: t('请输入职位', 'Enter your job title') }),
      field('lunch', t('是否需要午餐', 'Need lunch?'), 'RadioGroup', {
        options: [option(t('需要', 'Yes'), 'yes'), option(t('不需要', 'No'), 'no')]
      }),
      field('note', t('备注', 'Notes'), 'TextArea', { placeholder: t('其他需要主办方知道的信息', 'Anything else the organizer should know') })
    ])
  },
  {
    key: 'satisfaction',
    name: t('满意度调查', 'Satisfaction Survey'),
    description: t('了解一次服务或活动之后的满意程度和改进点。', 'Find out how satisfied people are after a service or event and what to improve.'),
    schema: schema('satisfaction', t('满意度调查', 'Satisfaction Survey'), [
      field('score', t('整体满意度', 'Overall satisfaction'), 'RadioGroup', {
        rule: 'REQ',
        options: [
          option(t('非常满意', 'Very satisfied'), '5'),
          option(t('满意', 'Satisfied'), '4'),
          option(t('一般', 'Neutral'), '3'),
          option(t('不满意', 'Dissatisfied'), '2'),
          option(t('非常不满意', 'Very dissatisfied'), '1')
        ]
      }),
      field('recommend', t('是否愿意推荐给其他人', 'Would you recommend us to others?'), 'RadioGroup', {
        options: [option(t('愿意', 'Yes'), 'yes'), option(t('不确定', 'Not sure'), 'maybe'), option(t('不愿意', 'No'), 'no')]
      }),
      field('liked', t('最满意的地方', 'What did you like most?'), 'TextArea', { placeholder: t('请写下最满意的部分', 'Tell us what you liked most') }),
      field('improve', t('希望改进的地方', 'What could be improved?'), 'TextArea', { placeholder: t('请写下可以改进的地方', 'Tell us what we could do better') })
    ])
  },
  {
    key: 'meeting-feedback',
    name: t('会议反馈', 'Meeting Feedback'),
    description: t('会后收集内容是否有用、节奏是否合适。', 'Collect feedback after a meeting on how useful the content was and whether the pace was right.'),
    schema: schema('meeting-feedback', t('会议反馈', 'Meeting Feedback'), [
      field('name', t('姓名', 'Name'), 'Input', { placeholder: t('选填', 'Optional') }),
      field('expectation', t('会议是否达到预期', 'Did the meeting meet your expectations?'), 'RadioGroup', {
        rule: 'REQ',
        options: [option(t('超出预期', 'Exceeded'), 'above'), option(t('符合预期', 'Met'), 'met'), option(t('低于预期', 'Below'), 'below')]
      }),
      field('useful', t('内容实用性', 'Usefulness of the content'), 'RadioGroup', {
        options: [option(t('很高', 'High'), 'high'), option(t('一般', 'Medium'), 'mid'), option(t('较低', 'Low'), 'low')]
      }),
      field('suggestion', t('建议', 'Suggestions'), 'TextArea', { placeholder: t('对内容、时长或形式的建议', 'Suggestions on content, length or format') })
    ])
  },
  {
    key: 'requirement',
    name: t('客户需求收集', 'Customer Requirements'),
    description: t('记录客户是谁、想解决什么问题，以及希望如何联系。', 'Record who the customer is, what they want to solve and how they prefer to be contacted.'),
    schema: schema('requirement', t('客户需求收集', 'Customer Requirements'), [
      field('name', t('称呼', 'Name'), 'Input', { rule: 'REQ', placeholder: t('怎么称呼您', 'How should we address you?') }),
      field('contact', t('联系方式', 'Contact'), 'Input', { rule: 'REQ', placeholder: t('手机或邮箱', 'Phone or email') }),
      field('type', t('需求类型', 'Request type'), 'RadioGroup', {
        rule: 'REQ',
        options: [
          option(t('产品咨询', 'Product inquiry'), 'product'),
          option(t('售后支持', 'After-sales support'), 'support'),
          option(t('商务合作', 'Partnership'), 'partner'),
          option(t('其他', 'Other'), 'other')
        ]
      }),
      field('detail', t('需求描述', 'Description'), 'TextArea', { rule: 'REQ', placeholder: t('请描述您希望解决的问题', 'Describe the problem you want to solve') })
    ])
  }
];

// 内置模版的名称、说明为 { 'zh-CN', 'en-US' }，库里只存中文；接口按 locale 取对应语言（当前语言 → zh-CN → en-US）
const pickText = (value, locale) => {
  if (value && typeof value === 'object') {
    return value[locale] || value['zh-CN'] || value['en-US'] || '';
  }
  return value == null ? '' : String(value);
};

const BUILTIN_BY_KEY = Object.fromEntries(DEFAULT_TEMPLATES.map(item => [item.key, item]));

const localizeBuiltinTemplate = (data, locale) => {
  const builtin = data && data.builtinKey ? BUILTIN_BY_KEY[data.builtinKey] : null;
  if (!builtin) {
    return data;
  }
  return Object.assign({}, data, { name: pickText(builtin.name, locale), description: pickText(builtin.description, locale) });
};

const matchBuiltinKeys = keyword => {
  const text = String(keyword || '').trim().toLowerCase();
  if (!text) {
    return [];
  }
  return DEFAULT_TEMPLATES.filter(item => Object.values(item.name).some(name => String(name).toLowerCase().includes(text))).map(item => item.key);
};

module.exports = { DEFAULT_TEMPLATES, pickText, localizeBuiltinTemplate, matchBuiltinKeys };
