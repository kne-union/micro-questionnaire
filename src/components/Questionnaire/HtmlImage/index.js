import { useLayoutEffect, useRef, useState } from 'react';
import { toJpeg, toPng } from 'html-to-image';
import style from './style.module.scss';

export { renderSafeHtml } from './sanitize';

export const HtmlImagePreview = ({ html, width, height, nodeRef, maxHeight = 520 }) => {
  const boxRef = useRef(null);
  const [boxWidth, setBoxWidth] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) {
      return;
    }
    const update = () => setBoxWidth(box.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const scale = boxWidth ? Math.min((boxWidth - 32) / width, maxHeight / height, 1) : 0;
  return (
    <div ref={boxRef} className={style['preview-box']}>
      <div className={style['preview-frame']} style={{ width: width * scale, height: height * scale }}>
        <div ref={nodeRef} className={style.canvas} style={{ width, height, transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
};

export const exportHtmlImage = (node, { width, height, type = 'png' }) =>
  (type === 'jpeg' ? toJpeg : toPng)(node, {
    width,
    height,
    pixelRatio: 1,
    quality: 0.92,
    skipFonts: true,
    style: { transform: 'none' }
  });
