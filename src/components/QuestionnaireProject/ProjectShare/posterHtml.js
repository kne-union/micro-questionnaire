import { BACKGROUND, QRCODE } from '@components/Questionnaire/HtmlImage/sanitize';

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, chr => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[chr]);

const clamp = lines => `display:-webkit-box;-webkit-line-clamp:${lines};-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;`;

const getLayout = (width, height) => {
  if (width > height * 1.2) {
    return { landscape: true, hero: '46%', title: 0.085, desc: 0.034, descLines: 3, qr: 0.26, padding: [0.09, 0.08] };
  }
  if (height >= width * 1.5) {
    return { landscape: false, hero: '50%', title: 0.095, desc: 0.036, descLines: 3, qr: 0.24, padding: [0.085, 0.08] };
  }
  if (height >= width * 1.2) {
    return { landscape: false, hero: '42%', title: 0.082, desc: 0.033, descLines: 3, qr: 0.2, padding: [0.07, 0.075] };
  }
  return { landscape: false, hero: '34%', title: 0.072, desc: 0.03, descLines: 2, qr: 0.17, padding: [0.06, 0.07] };
};

export const buildDefaultPosterHtml = ({ width, height, name, description, subtitle, themeColor, hasBackground, badge, scanTip, cta }) => {
  const short = Math.min(width, height);
  const layout = getLayout(width, height);
  const { landscape } = layout;
  const px = ratio => `${Math.round(short * ratio)}px`;
  const color = themeColor || '#4183F0';
  const text = String(description || '').trim() || String(subtitle || '').trim();
  const qrSize = Math.round(short * layout.qr);
  const radius = px(0.06);
  const [padY, padX] = layout.padding;

  const hero = hasBackground
    ? `background:#e8ebf0 url(${BACKGROUND}) center/cover no-repeat;`
    : `background:linear-gradient(135deg, ${color} 0%, ${color} 35%, #1f2a44 100%);`;
  const decorations = hasBackground
    ? ''
    : `<div style="position:absolute;right:-${px(0.18)};top:-${px(0.2)};width:${px(0.75)};height:${px(0.75)};border-radius:50%;background:rgba(255,255,255,0.12);"></div>
    <div style="position:absolute;left:-${px(0.12)};bottom:${px(0.04)};width:${px(0.42)};height:${px(0.42)};border-radius:50%;background:rgba(255,255,255,0.08);"></div>`;

  const heroBlock = `<div style="position:relative;flex:0 0 ${layout.hero};overflow:hidden;${hero}">
    ${decorations}
    <span style="position:absolute;left:${px(0.06)};top:${px(0.06)};padding:${px(0.012)} ${px(0.032)};border-radius:999px;background:rgba(255,255,255,0.92);color:${color};font-size:${px(0.03)};font-weight:700;letter-spacing:2px;box-shadow:0 4px 16px rgba(0,0,0,0.12);">${escapeHtml(badge)}</span>
  </div>`;

  const panelShape = landscape
    ? `margin-left:-${radius};border-radius:${radius} 0 0 ${radius};padding:${px(padY)} ${px(padX)};justify-content:center;`
    : `margin-top:-${radius};border-radius:${radius} ${radius} 0 0;padding:${px(padY)} ${px(padX)} ${px(padY * 0.85)};`;

  const panelBlock = `<div style="position:relative;flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;box-sizing:border-box;background:#fff;${panelShape}">
    <div style="flex:none;width:${px(0.08)};height:${px(0.012)};border-radius:999px;background:${color};"></div>
    <div style="flex:none;margin-top:${px(0.035)};font-size:${px(layout.title)};line-height:1.25;font-weight:800;color:#1f2329;${clamp(2)}">${escapeHtml(name)}</div>
    ${text ? `<div style="flex:none;margin-top:${px(0.025)};font-size:${px(layout.desc)};line-height:1.65;color:#646a73;${clamp(layout.descLines)}">${escapeHtml(text)}</div>` : ''}
    <div style="flex:${landscape ? 'none' : '1'};min-height:${px(0.04)};"></div>
    <div style="flex:none;display:flex;align-items:center;gap:${px(0.045)};padding-top:${px(0.045)};border-top:2px dashed #e5e6eb;">
      <div style="flex:none;padding:${px(0.012)};border:${px(0.006)} solid ${color};border-radius:${px(0.03)};background:#fff;">
        <img src="${QRCODE}" style="display:block;width:${qrSize}px;height:${qrSize}px;" />
      </div>
      <div style="display:flex;flex-direction:column;gap:${px(0.014)};min-width:0;">
        <div style="font-size:${px(layout.desc * 1.25)};font-weight:700;color:#1f2329;line-height:1.3;">${escapeHtml(scanTip)}</div>
        ${cta ? `<div style="font-size:${px(layout.desc * 0.85)};color:#8f959e;line-height:1.5;">${escapeHtml(cta)}</div>` : ''}
      </div>
    </div>
  </div>`;

  return `<div style="position:relative;width:${width}px;height:${height}px;overflow:hidden;box-sizing:border-box;display:flex;flex-direction:${landscape ? 'row' : 'column'};background:#fff;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">
  ${heroBlock}
  ${panelBlock}
</div>`;
};
