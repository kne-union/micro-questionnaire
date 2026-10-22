const { expect } = require('chai');
const { buildQuestionnaireColumns, formatFieldValue } = require('../libs/utils/questionnaire-excel');

describe('questionnaire excel', () => {
  describe('字段值格式化测试', () => {
    it('should return empty string for empty values', () => {
      expect(formatFieldValue({ type: 'Input' }, null)).to.equal('');
      expect(formatFieldValue({ type: 'Input' }, '')).to.equal('');
      expect(formatFieldValue({ type: 'Input' }, [])).to.equal('');
    });

    it('should format switch with default or custom labels', () => {
      expect(formatFieldValue({ type: 'Switch' }, true)).to.equal('是');
      expect(formatFieldValue({ type: 'Switch' }, false)).to.equal('否');
      expect(formatFieldValue({ type: 'Checkbox', props: { checkedChildren: '同意' } }, true)).to.equal('同意');
    });

    it('should format date picker value and range with format', () => {
      expect(formatFieldValue({ type: 'DatePicker' }, '2026-10-21T08:00:00')).to.equal('2026-10-21');
      expect(formatFieldValue({ type: 'DatePicker', props: { format: 'YYYY/MM' } }, ['2026-01-02', '2026-03-04'])).to.equal('2026/01 ~ 2026/03');
    });

    it('should map option values to labels', () => {
      const field = { type: 'Select', props: { options: [{ label: '甲', value: 'a' }, { label: '乙', value: 'b' }] } };
      expect(formatFieldValue(field, 'a')).to.equal('甲');
      expect(formatFieldValue(field, ['a', 'b', 'c'])).to.equal('甲、乙、c');
    });

    it('should stringify arrays and objects without options', () => {
      expect(formatFieldValue({ type: 'Input' }, [1, { a: 1 }])).to.equal('1、{"a":1}');
      expect(formatFieldValue({ type: 'Input' }, { a: 1 })).to.equal('{"a":1}');
      expect(formatFieldValue({ type: 'InputNumber' }, 0)).to.equal('0');
    });
  });

  describe('双语文案测试', () => {
    const schema = {
      blocks: [
        {
          kind: 'formInfo',
          title: { 'zh-CN': '基本信息', 'en-US': 'Basic Info' },
          list: [
            {
              name: 'gender',
              type: 'RadioGroup',
              label: { 'zh-CN': '性别', 'en-US': 'Gender' },
              props: { options: [{ label: { 'zh-CN': '男', 'en-US': 'Male' }, value: 'male' }, { label: '其他', value: 'other' }] }
            }
          ]
        }
      ]
    };

    it('should use the requested locale and fall back to zh-CN', () => {
      const [column] = buildQuestionnaireColumns(schema, 'en-US');
      expect(column.header).to.equal('Basic Info-Gender');
      expect(column.getValue({ gender: 'male' })).to.equal('Male');
      expect(column.getValue({ gender: 'other' })).to.equal('其他');
    });

    it('should fall back to en-US when zh-CN is missing', () => {
      const [column] = buildQuestionnaireColumns({ blocks: [{ kind: 'formInfo', list: [{ name: 'a', type: 'Input', label: { 'en-US': 'Only English' } }] }] }, 'zh-CN');
      expect(column.header).to.equal('Only English');
    });

    it('should default to zh-CN', () => {
      const [column] = buildQuestionnaireColumns(schema);
      expect(column.header).to.equal('基本信息-性别');
      expect(column.getValue({ gender: 'male' })).to.equal('男');
    });
  });

  describe('导出列构建测试', () => {
    it('should build columns from formInfo blocks and skip hidden fields', () => {
      const columns = buildQuestionnaireColumns({
        blocks: [
          {
            title: '基本信息',
            list: [{ name: 'name', label: '姓名' }, { name: 'secret', label: '隐藏', hidden: true }]
          }
        ]
      });
      expect(columns.map(column => column.header)).to.deep.equal(['基本信息-姓名']);
      expect(columns[0].getValue({ name: '张三' })).to.equal('张三');
    });

    it('should read nested value for object blocks and child blocks', () => {
      const columns = buildQuestionnaireColumns({
        blocks: [
          {
            kind: 'object',
            title: '联系人',
            name: 'contact',
            list: [{ name: 'phone', label: '电话' }],
            blocks: [{ title: '地址', list: [{ name: 'city', label: '城市' }] }]
          }
        ]
      });
      expect(columns.map(column => column.header)).to.deep.equal(['联系人-contact-电话', '联系人-contact-地址-城市']);
      expect(columns[0].getValue({ contact: { phone: '123' } })).to.equal('123');
      expect(columns[1].getValue({ city: '上海' })).to.equal('上海');
    });

    it('should return empty columns when schema is empty', () => {
      expect(buildQuestionnaireColumns(null)).to.deep.equal([]);
    });
  });
});
