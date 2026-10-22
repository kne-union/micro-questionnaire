export const QRCODE = '{{qrcode}}';
export const BACKGROUND = '{{background}}';

const cssUrl = value => {
  let decoded = String(value || '');
  try {
    decoded = decodeURI(decoded);
  } catch (e) {}
  return encodeURI(decoded).replace(/[()'"]/g, chr => `%${chr.charCodeAt(0).toString(16).toUpperCase()}`);
};

const removedTags = 'script,style,link,meta,base,iframe,frame,frameset,object,embed,form,input,button,textarea,select,video,audio,use,foreignObject';
const urlAttrs = ['src', 'href', 'xlink:href', 'srcset', 'action', 'formaction', 'background', 'poster'];

/**
 * AI 返回的 HTML 不可信：去掉脚本、样式表、事件属性和外部资源，只保留 {{qrcode}}、{{background}} 两个占位符引用的图片。
 */
export const renderSafeHtml = (html, { qrcode, background } = {}) => {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  doc.body.querySelectorAll(removedTags).forEach(node => node.remove());
  doc.body.querySelectorAll('*').forEach(node => {
    Array.from(node.attributes).forEach(attr => {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith('on')) {
        node.removeAttribute(attr.name);
        return;
      }
      if (urlAttrs.includes(attrName)) {
        const value = attr.value.trim();
        if (!(attrName === 'src' && ((value === QRCODE && qrcode) || (value === BACKGROUND && background)))) {
          node.removeAttribute(attr.name);
        }
        return;
      }
      if (attrName === 'style') {
        node.setAttribute(
          'style',
          attr.value.replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (match, quote, value) => (value.trim() === BACKGROUND && background ? match : 'none'))
        );
      }
    });
  });
  doc.body.querySelectorAll('img:not([src])').forEach(node => node.remove());
  return doc.body.innerHTML
    .split(QRCODE)
    .join(qrcode || '')
    .split(BACKGROUND)
    .join(background ? cssUrl(background) : '');
};
