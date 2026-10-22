const dayjs = require('dayjs');

const getByPath = (data, path) => {
  if (data == null || path == null || path === '') {
    return data;
  }
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? acc : acc[key]), data);
};

const isEmptyValue = value => {
  if (value == null || value === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
};

// schema 文案字段：字符串（旧格式，不论语言原样显示），或 { 'zh-CN': string, 'en-US': string }（当前语言 → zh-CN → en-US）
const pickText = (value, locale) => {
  if (value && typeof value === 'object') {
    return value[locale] || value['zh-CN'] || value['en-US'] || '';
  }
  return value == null ? '' : String(value);
};

const mapOptionLabel = (value, options, locale) => {
  if (!Array.isArray(options) || !options.length) {
    return value;
  }
  const match = options.find(item => item && item.value === value);
  return match ? pickText(match.label, locale) || value : value;
};

const formatDateValue = (value, format) => {
  const pattern = format || 'YYYY-MM-DD';
  if (Array.isArray(value)) {
    return value
      .map(item => formatDateValue(item, format))
      .filter(item => item !== '')
      .join(' ~ ');
  }
  if (value && typeof value.format === 'function') {
    return value.format(pattern);
  }
  if (value && (typeof value === 'string' || typeof value === 'number')) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format(pattern) : String(value);
  }
  return value == null ? '' : String(value);
};

const formatFieldValue = (field, value, locale) => {
  if (isEmptyValue(value)) {
    return '';
  }

  const props = field.props || {};
  const type = field.type;

  if (type === 'Switch' || type === 'Checkbox') {
    if (value) {
      return pickText(props.checkedChildren, locale) || '是';
    }
    return pickText(props.unCheckedChildren, locale) || '否';
  }

  if (type === 'DatePicker') {
    return formatDateValue(value, props.format) || '';
  }

  if (Array.isArray(props.options) && props.options.length) {
    if (Array.isArray(value)) {
      return value
        .map(item => mapOptionLabel(item, props.options, locale))
        .filter(item => item != null && item !== '')
        .join('、');
    }
    return mapOptionLabel(value, props.options, locale);
  }

  if (Array.isArray(value)) {
    return value.map(item => (item && typeof item === 'object' ? JSON.stringify(item) : String(item))).join('、');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const joinHeader = parts => parts.filter(Boolean).join('-');

const collectColumnsFromBlocks = (blocks, locale, headerPrefix = '') => {
  const columns = [];

  (blocks || []).forEach(block => {
    if (!block) {
      return;
    }

    const blockHeader = joinHeader([headerPrefix, pickText(block.title, locale) || pickText(block.label, locale)]);

    if (block.kind === 'formInfo' || !block.kind) {
      (block.list || [])
        .filter(field => field && field.name && !field.hidden)
        .forEach(field => {
          columns.push({
            header: joinHeader([blockHeader, pickText(field.label, locale) || field.name]),
            getValue: rowData => formatFieldValue(field, getByPath(rowData, field.name), locale)
          });
        });
      columns.push(...collectColumnsFromBlocks(block.blocks, locale, blockHeader));
      return;
    }

    if (block.kind === 'object') {
      const name = block.name != null && String(block.name).trim() ? String(block.name).trim() : '';
      const nestedHeader = joinHeader([blockHeader, name]);
      (block.list || [])
        .filter(field => field && field.name && !field.hidden)
        .forEach(field => {
          const fieldPath = name ? `${name}.${field.name}` : field.name;
          columns.push({
            header: joinHeader([nestedHeader, pickText(field.label, locale) || field.name]),
            getValue: rowData => formatFieldValue(field, getByPath(rowData, fieldPath), locale)
          });
        });
      columns.push(...collectColumnsFromBlocks(block.blocks, locale, nestedHeader));
    }
  });

  return columns;
};

const buildQuestionnaireColumns = (schema, locale) => collectColumnsFromBlocks(schema?.blocks || [], locale);

module.exports = {
  buildQuestionnaireColumns,
  formatFieldValue
};
