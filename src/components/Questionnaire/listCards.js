import { Skeleton } from 'antd';
import style from './listCards.module.scss';

const isSkeletonItem = item => String(item?.id || '').startsWith('__skeleton');

const partsOf = renderType => (typeof renderType === 'string' ? renderType.split('-').filter(Boolean) : []);

const isOptionsColumn = column => column?.name === 'options' || partsOf(column?.renderType).includes('options');

const isTagValue = value => value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'text');

const formatDate = (value, format) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = number => String(number).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (format === 'date') {
    return day;
  }
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const readValue = (column, item) => {
  if (isSkeletonItem(item)) {
    return '';
  }
  const value = typeof column.getValueOf === 'function' ? column.getValueOf(item) : item?.[column.name];
  if (typeof value === 'string' && value.startsWith('__skeleton')) {
    return '';
  }
  if (isTagValue(value)) {
    return value;
  }
  if ((column.format === 'datetime' || column.format === 'date') && value) {
    return formatDate(value, column.format) || String(value);
  }
  if (value == null || value === '') {
    return '';
  }
  return String(value);
};

const tagClassName = type => {
  if (type === 'success') {
    return style.tagSuccess;
  }
  if (type === 'processing') {
    return style.tagProcessing;
  }
  return style.tagDefault;
};

const readActions = (columns, item) => {
  const column = (columns || []).find(isOptionsColumn);
  if (typeof column?.getValueOf !== 'function') {
    return null;
  }
  const value = column.getValueOf(item, { place: 'end' });
  return value?.children || null;
};

export const renderListCards = ({ dataSource, displayDataSource, columns = [], renderToolbar, renderBody }) => {
  const list = displayDataSource || dataSource || [];
  if (!list.length) {
    return typeof renderBody === 'function' ? renderBody(list) : null;
  }
  if (list.every(isSkeletonItem)) {
    return (
      <div className={style.grid}>
        {list.map(item => (
          <article key={item.id} className={style.card} aria-hidden>
            <Skeleton active title={{ width: '42%' }} paragraph={{ rows: 2, width: ['86%', '38%'] }} />
          </article>
        ))}
      </div>
    );
  }

  const visibleColumns = columns.filter(column => column && !isOptionsColumn(column));
  const titleColumn = visibleColumns.find(column => partsOf(column.renderType).includes('main')) || visibleColumns[0];
  const tagColumns = visibleColumns.filter(column => column !== titleColumn && (partsOf(column.renderType).includes('tag') || partsOf(column.renderType).includes('status')));
  const descriptionColumn = visibleColumns.find(column => column !== titleColumn && partsOf(column.renderType).includes('description'));
  const metaColumns = visibleColumns.filter(column => column !== titleColumn && column !== descriptionColumn && !tagColumns.includes(column));

  return (
    <div className={style.wrap}>
      {typeof renderToolbar === 'function' ? renderToolbar() : null}
      <div className={style.grid}>
        {list.map(item => {
          const title = titleColumn ? readValue(titleColumn, item) : '';
          const titleText = isTagValue(title) ? title.text : title;
          const clickable = typeof titleColumn?.onClick === 'function';
          const description = descriptionColumn ? readValue(descriptionColumn, item) : '';
          const actions = readActions(columns, item);
          return (
            <article key={item.id} className={style.card}>
              <header className={style.head}>
                {clickable ? (
                  <button type="button" className={style.titleButton} onClick={() => titleColumn.onClick({ colItem: item, item: item?.[titleColumn.name] })}>
                    {titleText || '-'}
                  </button>
                ) : (
                  <h3 className={style.title}>{titleText || '-'}</h3>
                )}
                {tagColumns.length ? (
                  <div className={style.tags}>
                    {tagColumns.map(column => {
                      const value = readValue(column, item);
                      const text = isTagValue(value) ? value.text : value;
                      if (!text) {
                        return null;
                      }
                      return (
                        <span key={column.name} className={`${style.tag} ${tagClassName(isTagValue(value) ? value.type : 'default')}`}>
                          {text}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </header>
              {description ? <p className={style.desc}>{isTagValue(description) ? description.text : description}</p> : null}
              {metaColumns.length ? (
                <dl className={style.meta}>
                  {metaColumns.map(column => {
                    const value = readValue(column, item);
                    const text = isTagValue(value) ? value.text : value;
                    if (!text) {
                      return null;
                    }
                    return (
                      <div key={column.name} className={style.metaItem}>
                        <dt className={style.metaLabel}>{column.title}</dt>
                        <dd className={style.metaValue}>{text}</dd>
                      </div>
                    );
                  })}
                </dl>
              ) : null}
              {actions ? <footer className={style.footer}>{actions}</footer> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
};
