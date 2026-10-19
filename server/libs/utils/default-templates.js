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

const schema = (title, fields) => ({
  title,
  subtitle: '',
  column: 1,
  gap: 24,
  blocks: [
    {
      id: `block_${title}`,
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
    submitText: '提交',
    resetText: '',
    cancelText: '',
    align: 'center',
    gap: 16
  }
});

const DEFAULT_TEMPLATES = [
  {
    key: 'event-registration',
    name: '活动报名',
    description: '收集报名人的联系方式、公司和到场需求。',
    schema: schema('活动报名', [
      field('name', '姓名', 'Input', { rule: 'REQ', placeholder: '请输入姓名' }),
      field('mobile', '手机号', 'Input', { rule: 'REQ', placeholder: '请输入手机号' }),
      field('company', '公司', 'Input', { placeholder: '请输入公司名称' }),
      field('title', '职位', 'Input', { placeholder: '请输入职位' }),
      field('lunch', '是否需要午餐', 'RadioGroup', {
        options: [option('需要', 'yes'), option('不需要', 'no')]
      }),
      field('note', '备注', 'TextArea', { placeholder: '其他需要主办方知道的信息' })
    ])
  },
  {
    key: 'satisfaction',
    name: '满意度调查',
    description: '了解一次服务或活动之后的满意程度和改进点。',
    schema: schema('满意度调查', [
      field('score', '整体满意度', 'RadioGroup', {
        rule: 'REQ',
        options: [option('非常满意', '5'), option('满意', '4'), option('一般', '3'), option('不满意', '2'), option('非常不满意', '1')]
      }),
      field('recommend', '是否愿意推荐给其他人', 'RadioGroup', {
        options: [option('愿意', 'yes'), option('不确定', 'maybe'), option('不愿意', 'no')]
      }),
      field('liked', '最满意的地方', 'TextArea', { placeholder: '请写下最满意的部分' }),
      field('improve', '希望改进的地方', 'TextArea', { placeholder: '请写下可以改进的地方' })
    ])
  },
  {
    key: 'meeting-feedback',
    name: '会议反馈',
    description: '会后收集内容是否有用、节奏是否合适。',
    schema: schema('会议反馈', [
      field('name', '姓名', 'Input', { placeholder: '选填' }),
      field('expectation', '会议是否达到预期', 'RadioGroup', {
        rule: 'REQ',
        options: [option('超出预期', 'above'), option('符合预期', 'met'), option('低于预期', 'below')]
      }),
      field('useful', '内容实用性', 'RadioGroup', {
        options: [option('很高', 'high'), option('一般', 'mid'), option('较低', 'low')]
      }),
      field('suggestion', '建议', 'TextArea', { placeholder: '对内容、时长或形式的建议' })
    ])
  },
  {
    key: 'requirement',
    name: '客户需求收集',
    description: '记录客户是谁、想解决什么问题，以及希望如何联系。',
    schema: schema('客户需求收集', [
      field('name', '称呼', 'Input', { rule: 'REQ', placeholder: '怎么称呼您' }),
      field('contact', '联系方式', 'Input', { rule: 'REQ', placeholder: '手机或邮箱' }),
      field('type', '需求类型', 'RadioGroup', {
        rule: 'REQ',
        options: [option('产品咨询', 'product'), option('售后支持', 'support'), option('商务合作', 'partner'), option('其他', 'other')]
      }),
      field('detail', '需求描述', 'TextArea', { rule: 'REQ', placeholder: '请描述您希望解决的问题' })
    ])
  }
];

module.exports = { DEFAULT_TEMPLATES };
