import { createWithRemoteLoader } from '@kne/remote-loader';
import { App, Alert, Button, Input, InputNumber, Popconfirm, QRCode, Segmented, Select, Space, Spin, Tabs } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import classnames from 'classnames';
import { useIntl } from '@kne/react-intl';
import { useIsMobile } from '@kne/responsive-utils';
import withLocale from '@components/Questionnaire/withLocale';
import { HtmlImagePreview, exportHtmlImage, renderSafeHtml } from '@components/Questionnaire/HtmlImage';
import { pickLocaleText } from '../../../commons/schemaLanguages';
import { buildDefaultPosterHtml } from './posterHtml';
import style from './style.module.scss';

const sizePresets = [
  { key: 'mobile', label: 'QuestionnaireSharePosterSizeMobile', width: 750, height: 1334 },
  { key: 'story', label: 'QuestionnaireSharePosterSizeStory', width: 1080, height: 1920 },
  { key: 'portrait', label: 'QuestionnaireSharePosterSizePortrait', width: 1080, height: 1440 },
  { key: 'square', label: 'QuestionnaireSharePosterSizeSquare', width: 1080, height: 1080 },
  { key: 'landscape', label: 'QuestionnaireSharePosterSizeLandscape', width: 1920, height: 1080 }
];

const MIN_SIZE = 200;
const MAX_SIZE = 4000;
const MAX_POSTERS = 20;
const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const safeFileName = value => String(value || 'questionnaire').replace(/[\\/:*?"<>|\s]+/g, '-');

const downloadDataUrl = (dataUrl, filename) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// 命令式 modal 的 footer 在打开时就固定了，操作按钮通过该插槽 portal 进去以跟随弹窗内状态
export const createFooterSlot = () => {
  let node = null;
  const listeners = new Set();
  return {
    ref: current => {
      node = current;
      listeners.forEach(listener => listener(current));
    },
    get: () => node,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};

const useFooterNode = slot => {
  const [node, setNode] = useState(() => slot?.get() || null);
  useEffect(() => {
    if (!slot) {
      return undefined;
    }
    setNode(slot.get());
    return slot.subscribe(setNode);
  }, [slot]);
  return node;
};

const ProjectShare = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, data, url, footerSlot }) => {
    const [usePreset] = remoteModules;
    const { ajax, apis, appUrl } = usePreset();
    const { formatMessage, locale } = useIntl();
    const { message } = App.useApp();
    const isMobile = useIsMobile();
    const footerNode = useFooterNode(footerSlot);
    const qrcodeRef = useRef(null);
    const posterRef = useRef(null);
    const backgroundInput = useRef(null);
    const [tab, setTab] = useState('link');
    const [qrcode, setQrcode] = useState('');
    const [project, setProject] = useState(null);
    const [sizeKey, setSizeKey] = useState('mobile');
    const [customSize, setCustomSize] = useState({ width: 1080, height: 1600 });
    const [mode, setMode] = useState('default');
    const [requirement, setRequirement] = useState('');
    const [posters, setPosters] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [posterBackground, setPosterBackground] = useState(null);
    const [savingBackground, setSavingBackground] = useState(false);

    useEffect(() => {
      const canvas = qrcodeRef.current?.querySelector('canvas');
      setQrcode(canvas ? canvas.toDataURL('image/png') : '');
    }, [url]);

    useEffect(() => {
      let active = true;
      ajax(Object.assign({}, apis.questionnaire.projectDetail, { params: { id: data.id }, showError: false }))
        .then(({ data: resData }) => {
          if (active) {
            const detail = resData.code === 0 ? resData.data : data;
            setProject(detail);
            setPosterBackground(detail?.posterBackground || null);
          }
        })
        .catch(() => active && setProject(data));
      ajax(Object.assign({}, apis.questionnaire.projectPosterList, { params: { id: data.id }, showError: false }))
        .then(({ data: resData }) => {
          if (active && resData.code === 0) {
            const list = resData.data || [];
            setPosters(list);
            setSelectedId(list[0]?.id || null);
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [ajax, apis.questionnaire.projectDetail, apis.questionnaire.projectPosterList, data]);

    const preset = sizePresets.find(item => item.key === sizeKey);
    const size = preset ? { width: preset.width, height: preset.height } : customSize;
    const backgroundSrc = appUrl.api(project?.background?.url);
    const defaultBackgroundSrc = posterBackground?.url ? appUrl.api(posterBackground.url) : backgroundSrc;
    const aiPoster = posters.find(item => item.id === selectedId) || posters[0] || null;

    const posterHtml = useMemo(() => {
      if (!project || !qrcode) {
        return '';
      }
      if (mode === 'ai') {
        return aiPoster ? renderSafeHtml(aiPoster.html, { qrcode, background: backgroundSrc }) : '';
      }
      return renderSafeHtml(
        buildDefaultPosterHtml({
          width: size.width,
          height: size.height,
          name: pickLocaleText(project.name, locale),
          description: pickLocaleText(project.description, locale),
          subtitle: formatMessage({ id: 'QuestionnaireSharePosterSubtitle' }),
          themeColor: project.themeColor,
          hasBackground: !!defaultBackgroundSrc,
          badge: formatMessage({ id: 'QuestionnaireFillBadge' }),
          scanTip: formatMessage({ id: 'QuestionnaireShareScanTip' }),
          cta: formatMessage({ id: 'QuestionnaireSharePosterCta' })
        }),
        { qrcode, background: defaultBackgroundSrc }
      );
    }, [aiPoster, backgroundSrc, defaultBackgroundSrc, formatMessage, mode, project, qrcode, size.height, size.width]);

    const posterSize = mode === 'ai' && aiPoster ? aiPoster : size;

    const copyLink = async () => {
      try {
        await navigator.clipboard.writeText(url);
        message.success(formatMessage({ id: 'QuestionnaireProjectCopySuccess' }));
      } catch (error) {
        message.info(url);
      }
    };

    const copyQrcode = async () => {
      try {
        const blob = await (await fetch(qrcode)).blob();
        await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
        message.success(formatMessage({ id: 'QuestionnaireShareCopyQrcodeSuccess' }));
      } catch (error) {
        message.error(formatMessage({ id: 'QuestionnaireShareCopyQrcodeFailed' }));
      }
    };

    const generate = async () => {
      setGenerating(true);
      try {
        const { data: resData } = await ajax(
          Object.assign({}, apis.questionnaire.projectPosterGenerate, {
            data: { id: data.id, width: size.width, height: size.height, requirement, locale: locale === 'en-US' ? 'en-US' : 'zh-CN' }
          })
        );
        if (resData.code === 0 && resData.data?.html) {
          setPosters(list => [resData.data].concat(list).slice(0, MAX_POSTERS));
          setSelectedId(resData.data.id);
        }
      } finally {
        setGenerating(false);
      }
    };

    const removePoster = async poster => {
      const { data: resData } = await ajax(Object.assign({}, apis.questionnaire.projectPosterRemove, { data: { id: poster.id } }));
      if (resData.code !== 0) {
        return;
      }
      const rest = posters.filter(item => item.id !== poster.id);
      setPosters(rest);
      if (aiPoster?.id === poster.id) {
        setSelectedId(rest[0]?.id || null);
      }
      message.success(formatMessage({ id: 'QuestionnaireSharePosterDeleted' }));
    };

    const savePosterBackground = async background => {
      setSavingBackground(true);
      try {
        const { data: resData } = await ajax(Object.assign({}, apis.questionnaire.projectPosterBackground, { data: { id: data.id, background } }));
        if (resData.code === 0) {
          setPosterBackground(resData.data?.posterBackground || null);
          message.success(formatMessage({ id: 'QuestionnaireSharePosterBackgroundSaved' }));
        }
      } finally {
        setSavingBackground(false);
      }
    };

    const onPickBackground = async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      const extension = `.${String(file.name || '').split('.').pop() || ''}`.toLowerCase();
      if (!IMAGE_ACCEPT.split(',').includes(extension)) {
        message.error(formatMessage({ id: 'QuestionnaireProjectAppearanceImageOnly' }));
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        message.error(formatMessage({ id: 'QuestionnaireProjectAppearanceTooLarge' }));
        return;
      }
      setSavingBackground(true);
      try {
        const response = await apis.file.upload({ file });
        const body = response?.data;
        if (!body || body.code !== 0 || !body.data?.id) {
          message.error(body?.msg || formatMessage({ id: 'QuestionnaireProjectAppearanceUploadFailed' }));
          return;
        }
        await savePosterBackground([{ id: body.data.id, filename: body.data.filename || file.name }]);
      } finally {
        setSavingBackground(false);
      }
    };

    const downloadPoster = async () => {
      if (!posterRef.current) {
        return;
      }
      setExporting(true);
      try {
        const dataUrl = await exportHtmlImage(posterRef.current, posterSize);
        downloadDataUrl(dataUrl, `${safeFileName(pickLocaleText(data.name, locale))}-${posterSize.width}x${posterSize.height}.png`);
      } catch (error) {
        console.error(error);
        message.error(formatMessage({ id: 'QuestionnaireSharePosterDownloadFailed' }));
      } finally {
        setExporting(false);
      }
    };

    const formatTime = value => (value ? new Date(value).toLocaleString(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

    const aiSizeChanged = mode === 'ai' && aiPoster && (aiPoster.width !== size.width || aiPoster.height !== size.height);

    const linkTab = (
      <div className={style.link}>
        <div className={style.qrcode}>
          <div className={style['qrcode-image']}>{qrcode ? <img src={qrcode} alt="" /> : null}</div>
          <div className={style.tip}>{formatMessage({ id: 'QuestionnaireShareScanTip' })}</div>
        </div>
        <div className={style['link-main']}>
          <div className={style['section-title']}>{formatMessage({ id: 'QuestionnaireShareLinkLabel' })}</div>
          <Input size="large" readOnly value={url} onFocus={event => event.target.select()} />
          <div className={style.tip}>{formatMessage({ id: 'QuestionnaireShareLinkTip' })}</div>
        </div>
      </div>
    );

    const settings = (
      <div className={style.settings}>
        <Segmented
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: 'default', label: formatMessage({ id: 'QuestionnaireSharePosterDefault' }) },
            { value: 'ai', label: formatMessage({ id: 'QuestionnaireSharePosterAi' }) }
          ]}
        />
        <div className={style.field}>
          <span className={style.label}>{formatMessage({ id: 'QuestionnaireSharePosterSize' })}</span>
          <Select
            value={sizeKey}
            onChange={setSizeKey}
            options={sizePresets
              .map(item => ({ value: item.key, label: `${formatMessage({ id: item.label })} ${item.width}×${item.height}` }))
              .concat({ value: 'custom', label: formatMessage({ id: 'QuestionnaireSharePosterSizeCustom' }) })}
          />
          {sizeKey === 'custom' ? (
            <Space.Compact block>
              <InputNumber min={MIN_SIZE} max={MAX_SIZE} precision={0} prefix="W" value={customSize.width} onChange={value => value && setCustomSize(current => Object.assign({}, current, { width: value }))} />
              <InputNumber min={MIN_SIZE} max={MAX_SIZE} precision={0} prefix="H" value={customSize.height} onChange={value => value && setCustomSize(current => Object.assign({}, current, { height: value }))} />
            </Space.Compact>
          ) : null}
        </div>
        {mode === 'default' ? (
          <div className={style.field}>
            <span className={style.label}>{formatMessage({ id: 'QuestionnaireSharePosterBackground' })}</span>
            <div className={style.background}>
              <div
                className={style['background-thumb']}
                style={defaultBackgroundSrc ? { backgroundImage: `url(${defaultBackgroundSrc})` } : { background: `linear-gradient(160deg, ${project?.themeColor || '#4183F0'} 0%, #1f2a44 100%)` }}
              />
              <div className={style['background-text']}>
                <div className={style.tip}>
                  {formatMessage({
                    id: posterBackground ? 'QuestionnaireSharePosterBackgroundCustom' : backgroundSrc ? 'QuestionnaireSharePosterBackgroundTip' : 'QuestionnaireSharePosterBackgroundNone'
                  })}
                </div>
                <Space size={4} wrap>
                  <Button size="small" loading={savingBackground} onClick={() => backgroundInput.current?.click()}>
                    {formatMessage({ id: posterBackground ? 'QuestionnaireSharePosterBackgroundChange' : 'QuestionnaireSharePosterBackgroundUpload' })}
                  </Button>
                  {posterBackground ? (
                    <Button size="small" type="text" disabled={savingBackground} onClick={() => savePosterBackground([])}>
                      {formatMessage({ id: 'QuestionnaireSharePosterBackgroundReset' })}
                    </Button>
                  ) : null}
                </Space>
              </div>
            </div>
            <input ref={backgroundInput} className={style.file} type="file" accept={IMAGE_ACCEPT} onChange={onPickBackground} />
          </div>
        ) : (
          <>
            <div className={style.field}>
              <Input.TextArea
                value={requirement}
                maxLength={2000}
                autoSize={{ minRows: 3, maxRows: 5 }}
                placeholder={formatMessage({ id: 'QuestionnaireSharePosterRequirementPlaceholder' })}
                onChange={event => setRequirement(event.target.value)}
              />
              <span className={style.tip}>{formatMessage({ id: 'QuestionnaireSharePosterSavedTip' })}</span>
            </div>
            {posters.length ? (
              <div className={style['poster-list']}>
                {posters.map(poster => (
                  <div key={poster.id} className={classnames(style['poster-item'], { [style.active]: poster.id === aiPoster?.id })} title={`${poster.width}×${poster.height} ${formatTime(poster.createdAt)}`} onClick={() => setSelectedId(poster.id)}>
                    {qrcode ? <HtmlImagePreview html={renderSafeHtml(poster.html, { qrcode, background: backgroundSrc })} width={poster.width} height={poster.height} maxHeight={72} /> : null}
                    <Popconfirm title={formatMessage({ id: 'QuestionnaireSharePosterDeleteConfirm' })} onConfirm={() => removePoster(poster)}>
                      <Button className={style['poster-remove']} size="small" type="text" danger icon={<DeleteOutlined />} aria-label={formatMessage({ id: 'QuestionnaireSharePosterDelete' })} onClick={event => event.stopPropagation()} />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
        {aiSizeChanged ? <Alert type="warning" showIcon message={formatMessage({ id: 'QuestionnaireSharePosterAiSizeChanged' })} /> : null}
      </div>
    );

    const posterTab = (
      <div className={style.poster}>
        {settings}
        <div className={style.stage}>
          <Spin spinning={!project || generating}>
            {posterHtml ? (
              <HtmlImagePreview html={posterHtml} width={posterSize.width} height={posterSize.height} nodeRef={posterRef} maxHeight={isMobile ? 360 : 420} />
            ) : (
              <div className={style.empty}>{mode === 'ai' ? formatMessage({ id: 'QuestionnaireSharePosterAiEmpty' }) : null}</div>
            )}
          </Spin>
        </div>
      </div>
    );

    const footerActions =
      tab === 'link' ? (
        <div className={style.footer}>
          <Button href={url} target="_blank">
            {formatMessage({ id: 'QuestionnaireShareOpen' })}
          </Button>
          <div className={style['footer-actions']}>
            <Button onClick={copyQrcode} disabled={!qrcode}>
              {formatMessage({ id: 'QuestionnaireShareCopyQrcode' })}
            </Button>
            <Button onClick={() => downloadDataUrl(qrcode, `${safeFileName(pickLocaleText(data.name, locale))}-qrcode.png`)} disabled={!qrcode}>
              {formatMessage({ id: 'QuestionnaireShareDownloadQrcode' })}
            </Button>
            <Button type="primary" onClick={copyLink}>
              {formatMessage({ id: 'QuestionnaireProjectCopy' })}
            </Button>
          </div>
        </div>
      ) : (
        <div className={style.footer}>
          <span className={style.tip}>{posterHtml ? formatMessage({ id: 'QuestionnaireSharePosterOutput' }, { width: posterSize.width, height: posterSize.height }) : null}</span>
          <div className={style['footer-actions']}>
            {mode === 'ai' ? (
              <Button loading={generating} onClick={generate}>
                {formatMessage({ id: 'QuestionnaireSharePosterGenerate' })}
              </Button>
            ) : null}
            <Button type="primary" disabled={!posterHtml || generating} loading={exporting} onClick={downloadPoster}>
              {formatMessage({ id: 'QuestionnaireSharePosterDownload' })}
            </Button>
          </div>
        </div>
      );

    const footerContent = <div className={classnames(style['footer-root'], { [style['is-mobile']]: isMobile })}>{footerActions}</div>;

    return (
      <div className={classnames(style.share, { [style['is-mobile']]: isMobile })}>
        <div ref={qrcodeRef} className={style['qrcode-source']}>
          <QRCode value={url} type="canvas" size={1024} marginSize={2} bordered={false} color="#000000" bgColor="#ffffff" errorLevel="M" />
        </div>
        <Tabs
          className={style.tabs}
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'link', label: formatMessage({ id: 'QuestionnaireShareLinkTab' }), children: linkTab },
            { key: 'poster', label: formatMessage({ id: 'QuestionnaireSharePosterTab' }), children: posterTab }
          ]}
        />
        {footerNode ? createPortal(footerContent, footerNode) : footerContent}
      </div>
    );
  })
);

export default ProjectShare;
