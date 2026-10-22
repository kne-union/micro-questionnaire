import { createWithRemoteLoader } from '@kne/remote-loader';
import { App, Button, ColorPicker, ConfigProvider, Result, Space, Spin, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import withLocale from '@components/Questionnaire/withLocale';
import BannerSlides from '@components/Questionnaire/BannerSlides';
import SchemaHost from '@components/Questionnaire/SchemaHost';
import fill from '../QuestionnaireFill/style.module.scss';
import { pickLocaleText } from '../../commons/schemaLanguages';
import presetBackgrounds, { matchPresetBackground, presetBackgroundUrl, uploadPresetBackground } from '../../commons/presetBackgrounds';
import AiImageModal from './AiImageModal';
import style from './style.module.scss';

const imageAccept = '.jpg,.jpeg,.png,.webp,.gif';
const maxBanners = 5;

const browserFillLocale = () => {
  const list = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language];
  for (const item of list) {
    const value = String(item || '').toLowerCase();
    if (value.startsWith('zh')) {
      return 'zh-CN';
    }
    if (value.startsWith('en')) {
      return 'en-US';
    }
  }
  return 'zh-CN';
};

const HeroBadge = withLocale(({ className }) => {
  const { formatMessage } = useIntl();
  return <span className={className}>{formatMessage({ id: 'QuestionnaireFillBadge' })}</span>;
});

const toFileValue = image => ({ id: image.id, filename: image.filename, originalName: image.filename });

// 改动只作用于预览草稿，由弹窗 footer 的保存按钮调用 saveRef.current() 统一提交
const ProjectAppearance = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, projectId, saveRef }) => {
    const [usePreset] = remoteModules;
    const { ajax, apis, appUrl } = usePreset();
    const { formatMessage } = useIntl();
    const { message } = App.useApp();
    const backgroundInput = useRef(null);
    const bannerInput = useRef(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(null);
    const [error, setError] = useState(null);
    const [project, setProject] = useState(null);
    const [locale, setLocale] = useState('zh-CN');
    const [aiKind, setAiKind] = useState(null);

    const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: resData } = await ajax(
          Object.assign({}, apis.questionnaire.projectDetail, {
            params: { id: projectId },
            showError: false
          })
        );
        if (resData.code !== 0) {
          setError(resData.msg || formatMessage({ id: 'QuestionnaireFillLoadFailed' }));
          return;
        }
        const data = resData.data || {};
        setProject({
          name: data.name,
          description: data.description || '',
          schema: data.schema || {},
          language: data.language,
          themeColor: data.themeColor || null,
          background: data.background?.url ? data.background : null,
          banners: data.banners || []
        });
        setLocale(data.language === 'zh-CN' || data.language === 'en-US' ? data.language : browserFillLocale());
      } catch (err) {
        setError(err?.message || formatMessage({ id: 'QuestionnaireFillLoadFailed' }));
      } finally {
        setLoading(false);
      }
    }, [ajax, apis.questionnaire.projectDetail, formatMessage, projectId]);

    useEffect(() => {
      load();
    }, [load]);

    const save = async () => {
      if (!project) {
        return false;
      }
      const { data: resData } = await ajax(
        Object.assign({}, apis.questionnaire.projectAppearance, {
          data: {
            id: projectId,
            themeColor: project.themeColor || null,
            background: project.background ? [toFileValue(project.background)] : [],
            banners: (project.banners || []).map(toFileValue)
          }
        })
      );
      if (resData.code !== 0) {
        return false;
      }
      message.success(formatMessage({ id: 'QuestionnaireProjectAppearanceSuccess' }));
      return true;
    };

    if (saveRef) {
      saveRef.current = save;
    }

    const update = patch => setProject(current => Object.assign({}, current, patch));

    const fileUrl = async id => {
      const { data: urlBody } = await ajax({
        url: `/api/v1/static/file-url/${id}`,
        method: 'GET',
        showError: false
      });
      const url = typeof urlBody === 'string' ? urlBody : urlBody?.data;
      return typeof url === 'string' ? url : '';
    };

    const uploadImage = async file => {
      const extension = `.${String(file.name || '').split('.').pop() || ''}`.toLowerCase();
      if (!imageAccept.split(',').includes(extension)) {
        message.error(formatMessage({ id: 'QuestionnaireProjectAppearanceImageOnly' }));
        return null;
      }
      if (file.size > 8 * 1024 * 1024) {
        message.error(formatMessage({ id: 'QuestionnaireProjectAppearanceTooLarge' }));
        return null;
      }
      const response = await apis.file.upload({ file });
      const body = response?.data;
      if (!body || body.code !== 0 || !body.data?.id) {
        message.error(body?.msg || formatMessage({ id: 'QuestionnaireProjectAppearanceUploadFailed' }));
        return null;
      }
      const record = body.data;
      return {
        id: record.id,
        filename: record.filename || file.name,
        url: await fileUrl(record.id)
      };
    };

    const withUploading = async (key, task) => {
      setUploading(key);
      try {
        return await task();
      } finally {
        setUploading(null);
      }
    };

    const onPickBackground = async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !project) {
        return;
      }
      const image = await withUploading('background', () => uploadImage(file));
      image && update({ background: image });
    };

    const onPickBanner = async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !project || (project.banners || []).length >= maxBanners) {
        return;
      }
      const image = await withUploading('banner', () => uploadImage(file));
      image && update({ banners: (project.banners || []).concat(image) });
    };

    const onPickPreset = async key => {
      const image = await withUploading(key, async () => {
        const record = await uploadPresetBackground({ appUrl, apis, key });
        return record ? Object.assign({}, record, { url: await fileUrl(record.id) }) : null;
      });
      if (!image) {
        message.error(formatMessage({ id: 'QuestionnaireProjectAppearanceUploadFailed' }));
        return;
      }
      update({ background: image });
    };

    const onApplyAiImage = async file => {
      const kind = aiKind;
      const image = await withUploading(kind, () => uploadImage(file));
      if (!image) {
        return;
      }
      setAiKind(null);
      if (kind === 'banner') {
        update({ banners: (project.banners || []).concat(image).slice(0, maxBanners) });
        return;
      }
      update({ background: image });
    };

    if (loading) {
      return (
        <div className={fill.page}>
          <div className={fill.loading}>
            <Spin size="large" />
          </div>
        </div>
      );
    }

    if (error || !project) {
      return (
        <div className={fill.page}>
          <div className={fill.content}>
            <Result status="error" title={formatMessage({ id: 'QuestionnaireFillLoadFailed' })} subTitle={error} />
          </div>
        </div>
      );
    }

    const busy = !!uploading;
    const backgroundSrc = appUrl.api(project.background?.url);
    const banners = (project.banners || []).map(item => Object.assign({}, item, { src: appUrl.api(item.url) })).filter(item => item.src);
    const themeColor = project.themeColor || null;
    const activePreset = matchPresetBackground(project.background);

    const editor = (
      <div className={style.editor}>
        <div className={style.toolbar}>
          <span className={style.theme}>
            <span>{formatMessage({ id: 'QuestionnaireProjectThemeColor' })}</span>
            <ColorPicker
              value={themeColor || '#4183F0'}
              disabledAlpha
              allowClear
              onChangeComplete={color => {
                const hex = typeof color?.toHexString === 'function' ? color.toHexString().slice(0, 7) : '';
                /^#[0-9a-fA-F]{6}$/.test(hex) && update({ themeColor: hex });
              }}
              onClear={() => update({ themeColor: null })}
            />
          </span>
          <Space.Compact>
            <Button type="primary" disabled={busy} loading={uploading === 'background'} onClick={() => backgroundInput.current?.click()}>
              {formatMessage({ id: 'QuestionnaireProjectAppearanceUploadBackground' })}
            </Button>
            <Button type="primary" disabled={busy} onClick={() => setAiKind('background')}>
              {formatMessage({ id: 'QuestionnaireProjectAppearanceAiBackground' })}
            </Button>
            {project.background ? (
              <Button type="primary" disabled={busy} onClick={() => update({ background: null })}>
                {formatMessage({ id: 'QuestionnaireProjectAppearanceClearBackground' })}
              </Button>
            ) : null}
          </Space.Compact>
          {banners.length < maxBanners ? (
            <Space.Compact>
              <Button type="primary" disabled={busy} loading={uploading === 'banner'} onClick={() => bannerInput.current?.click()}>
                {formatMessage({ id: 'QuestionnaireProjectAppearanceAddBanner' })}
              </Button>
              <Button type="primary" disabled={busy} onClick={() => setAiKind('banner')}>
                {formatMessage({ id: 'QuestionnaireProjectAppearanceAiBanner' })}
              </Button>
            </Space.Compact>
          ) : null}
          <input ref={backgroundInput} className={style.file} type="file" accept={imageAccept} onChange={onPickBackground} />
          <input ref={bannerInput} className={style.file} type="file" accept={imageAccept} onChange={onPickBanner} />
          {aiKind ? <AiImageModal kind={aiKind} projectId={projectId} ajax={ajax} apis={apis} onCancel={() => setAiKind(null)} onApply={onApplyAiImage} /> : null}
        </div>
        <div className={style.presets}>
          <span className={style['presets-label']}>{formatMessage({ id: 'QuestionnairePresetBackground' })}</span>
          <div className={style['presets-list']}>
            {presetBackgrounds.map(item => (
              <button
                key={item.key}
                type="button"
                title={formatMessage({ id: item.labelId })}
                disabled={busy}
                className={classnames(style.preset, { [style['preset-active']]: activePreset?.key === item.key })}
                style={{ backgroundImage: `url(${presetBackgroundUrl(appUrl, item.key)})` }}
                onClick={() => onPickPreset(item.key)}
              >
                {uploading === item.key ? <Spin size="small" /> : null}
              </button>
            ))}
          </div>
        </div>
        <div className={style.viewport}>
          {backgroundSrc ? (
            <div className={classnames(fill.backdrop, style.backdrop)}>
              <img src={backgroundSrc} alt="" />
            </div>
          ) : null}
          <div className={style.scroller}>
            <div className={classnames(fill.page, style.page, { [fill['has-bg']]: !!backgroundSrc })} style={themeColor ? { '--primary-color': themeColor } : undefined}>
              <div className={fill.column}>
                <BannerSlides
                  items={banners}
                  renderExtra={item => (
                    <button type="button" className={style.remove} disabled={busy} onClick={() => update({ banners: project.banners.filter(banner => banner.id !== item.id) })}>
                      {formatMessage({ id: 'QuestionnaireProjectAppearanceRemove' })}
                    </button>
                  )}
                />
                <header className={fill.hero}>
                  <div className={fill['hero-inner']}>
                    <div className={fill['hero-bar']}>
                      <HeroBadge locale={locale} className={fill['hero-badge']} />
                      {project.language === 'both' ? (
                        <div className={fill.lang}>
                          <button type="button" className={locale === 'zh-CN' ? fill['lang-on'] : ''} onClick={() => setLocale('zh-CN')}>
                            中文
                          </button>
                          <button type="button" className={locale === 'en-US' ? fill['lang-on'] : ''} onClick={() => setLocale('en-US')}>
                            EN
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <Typography.Title level={2} className={fill['hero-title']}>
                      {pickLocaleText(project.name, locale)}
                    </Typography.Title>
                    {pickLocaleText(project.description, locale).trim() ? <div className={fill['hero-notice']}>{pickLocaleText(project.description, locale)}</div> : null}
                  </div>
                </header>
                <div className={fill.content}>
                  <div className={fill.panel}>
                    <SchemaHost
                      locale={locale}
                      schema={project.schema}
                      onSubmit={() => {
                        message.info(formatMessage({ id: 'QuestionnaireProjectAppearancePreview' }));
                        return false;
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
    if (!themeColor) {
      return editor;
    }
    return <ConfigProvider theme={{ token: { colorPrimary: themeColor } }}>{editor}</ConfigProvider>;
  })
);

export default ProjectAppearance;
