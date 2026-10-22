import { createWithRemoteLoader } from '@kne/remote-loader';
import { App, Button, ColorPicker, ConfigProvider, Result, Spin, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from '@kne/react-intl';
import withLocale from '@components/Questionnaire/withLocale';
import BannerSlides from '@components/Questionnaire/BannerSlides';
import SchemaHost from '@components/Questionnaire/SchemaHost';
import fill from '../QuestionnaireFill/style.module.scss';
import { pickLocaleText } from '../../commons/schemaLanguages';
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

const ProjectAppearance = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, projectId }) => {
    const [usePreset] = remoteModules;
    const { ajax, apis, appUrl } = usePreset();
    const { formatMessage } = useIntl();
    const { message } = App.useApp();
    const backgroundInput = useRef(null);
    const bannerInput = useRef(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [project, setProject] = useState(null);
    const [locale, setLocale] = useState('zh-CN');
    const colorDraftRef = useRef(undefined);
    const [colorDraft, setColorDraft] = useState(undefined);
    const [pickerKey, setPickerKey] = useState(0);
    const [aiKind, setAiKind] = useState(null);
    const setColorDraftValue = value => {
      colorDraftRef.current = value;
      setColorDraft(value);
    };

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

    const persist = async next => {
      setSaving(true);
      const previous = project;
      setProject(next);
      try {
        const { data: resData } = await ajax(
          Object.assign({}, apis.questionnaire.projectAppearance, {
            data: {
              id: projectId,
              themeColor: next.themeColor || null,
              background: next.background ? [{ id: next.background.id, filename: next.background.filename, originalName: next.background.filename }] : [],
              banners: (next.banners || []).map(item => ({ id: item.id, filename: item.filename, originalName: item.filename }))
            }
          })
        );
        if (resData.code !== 0) {
          setProject(previous);
          return;
        }
        message.success(formatMessage({ id: 'QuestionnaireProjectAppearanceSuccess' }));
      } catch (err) {
        setProject(previous);
      } finally {
        setSaving(false);
      }
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
      const { data: urlBody } = await ajax({
        url: `/api/v1/static/file-url/${record.id}`,
        method: 'GET',
        showError: false
      });
      const url = typeof urlBody === 'string' ? urlBody : urlBody?.data;
      return {
        id: record.id,
        filename: record.filename || file.name,
        url: typeof url === 'string' ? url : ''
      };
    };

    const onPickBackground = async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !project) {
        return;
      }
      const image = await uploadImage(file);
      if (!image) {
        return;
      }
      persist(Object.assign({}, project, { background: image }));
    };

    const onPickBanner = async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !project || (project.banners || []).length >= maxBanners) {
        return;
      }
      const image = await uploadImage(file);
      if (!image) {
        return;
      }
      persist(Object.assign({}, project, { banners: (project.banners || []).concat(image) }));
    };

    const onApplyAiImage = async file => {
      const image = await uploadImage(file);
      if (!image) {
        return;
      }
      const kind = aiKind;
      setAiKind(null);
      if (kind === 'banner') {
        persist(Object.assign({}, project, { banners: (project.banners || []).concat(image).slice(0, maxBanners) }));
        return;
      }
      persist(Object.assign({}, project, { background: image }));
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

    const backgroundSrc = appUrl.api(project.background?.url);
    const banners = (project.banners || []).map(item => Object.assign({}, item, { src: appUrl.api(item.url) })).filter(item => item.src);
    const savedColor = project.themeColor || null;
    const themeColor = colorDraft === undefined ? savedColor : colorDraft;
    const pageStyle = Object.assign({}, backgroundSrc ? { backgroundImage: `url(${backgroundSrc})` } : {}, themeColor ? { '--primary-color': themeColor } : {});
    const page = (
      <div className={backgroundSrc ? `${fill.page} ${fill['has-bg']} ${style.stage}` : `${fill.page} ${style.stage}`} style={pageStyle}>
        <div className={style.toolbar}>
          <span className={style.theme}>
            <span>{formatMessage({ id: 'QuestionnaireProjectThemeColor' })}</span>
            <ColorPicker
              key={pickerKey}
              value={colorDraft === null ? null : themeColor || '#4183F0'}
              disabled={saving}
              disabledAlpha
              allowClear
              destroyOnHidden
              onChange={color => {
                if (!color || color.cleared) {
                  setColorDraftValue(null);
                  return;
                }
                const hex = typeof color.toHexString === 'function' ? color.toHexString().slice(0, 7) : '';
                if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
                  return;
                }
                if (hex.toLowerCase() === (savedColor || '').toLowerCase()) {
                  setColorDraftValue(undefined);
                  return;
                }
                setColorDraftValue(hex);
              }}
              onClear={() => setColorDraftValue(null)}
              onOpenChange={open => {
                if (open) {
                  setColorDraftValue(undefined);
                  return;
                }
                const next = colorDraftRef.current === undefined ? savedColor : colorDraftRef.current;
                setColorDraftValue(undefined);
                setPickerKey(key => key + 1);
                if ((next || null) !== savedColor) {
                  persist(Object.assign({}, project, { themeColor: next }));
                }
              }}
            />
          </span>
          <Button disabled={saving} onClick={() => backgroundInput.current?.click()}>
            {formatMessage({ id: project.background ? 'QuestionnaireProjectAppearanceChangeBackground' : 'QuestionnaireProjectAppearanceAddBackground' })}
          </Button>
          <Button disabled={saving} onClick={() => setAiKind('background')}>
            {formatMessage({ id: 'QuestionnaireProjectAppearanceAiBackground' })}
          </Button>
          {project.background ? (
            <Button disabled={saving} onClick={() => persist(Object.assign({}, project, { background: null }))}>
              {formatMessage({ id: 'QuestionnaireProjectAppearanceClearBackground' })}
            </Button>
          ) : null}
          {banners.length < maxBanners ? (
            <Button disabled={saving} onClick={() => bannerInput.current?.click()}>
              {formatMessage({ id: 'QuestionnaireProjectAppearanceAddBanner' })}
            </Button>
          ) : null}
          {banners.length < maxBanners ? (
            <Button disabled={saving} onClick={() => setAiKind('banner')}>
              {formatMessage({ id: 'QuestionnaireProjectAppearanceAiBanner' })}
            </Button>
          ) : null}
          <input ref={backgroundInput} className={style.file} type="file" accept={imageAccept} onChange={onPickBackground} />
          <input ref={bannerInput} className={style.file} type="file" accept={imageAccept} onChange={onPickBanner} />
          {aiKind ? <AiImageModal kind={aiKind} projectId={projectId} ajax={ajax} apis={apis} onCancel={() => setAiKind(null)} onApply={onApplyAiImage} /> : null}
        </div>
        <div className={`${fill.column} ${style.column}`}>
          <BannerSlides
            items={banners}
            renderExtra={item => (
              <button
                type="button"
                className={style.remove}
                disabled={saving}
                onClick={() => persist(Object.assign({}, project, { banners: project.banners.filter(banner => banner.id !== item.id) }))}
              >
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
    );
    if (!themeColor) {
      return page;
    }
    return <ConfigProvider theme={{ token: { colorPrimary: themeColor } }}>{page}</ConfigProvider>;
  })
);

export default ProjectAppearance;
