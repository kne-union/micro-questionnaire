import { createWithRemoteLoader } from '@kne/remote-loader';
import { App, ConfigProvider, Result, Spin, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useIntl } from '@kne/react-intl';
import withLocale from '@components/Questionnaire/withLocale';
import BannerSlides from '@components/Questionnaire/BannerSlides';
import style from './style.module.scss';

const storageKey = code => `questionnaire-lang:${code}`;

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

const resolveFillLocale = (language, code) => {
  if (language === 'zh-CN' || language === 'en-US') {
    return language;
  }
  const stored = window.sessionStorage.getItem(storageKey(code));
  if (stored === 'zh-CN' || stored === 'en-US') {
    return stored;
  }
  return browserFillLocale();
};

const fileSrc = (staticUrl, url) => {
  if (!url) {
    return '';
  }
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  return `${staticUrl || ''}${url}`;
};

const FillBackdrop = ({ src }) => {
  if (!src) {
    return null;
  }
  return (
    <div className={style.backdrop}>
      <img src={src} alt="" />
    </div>
  );
};

const FillContent = withLocale(({ staticUrl, context, onSubmit, done, onSwitch }) => {
  const { formatMessage, locale } = useIntl();
  const { message } = App.useApp();
  const badge = formatMessage({ id: 'QuestionnaireFillBadge' });
  const backgroundSrc = fileSrc(staticUrl, context.background?.url);
  const bannerList = (context.banners || []).map(item => Object.assign({}, item, { src: fileSrc(staticUrl, item.url) })).filter(item => item.src);
  const submit = async answers => {
    const ok = await onSubmit(answers);
    if (ok === false) {
      return false;
    }
    message.success(formatMessage({ id: 'QuestionnaireFillSubmitSuccess' }));
  };

  const page = (
    <div className={context.background ? `${style.page} ${style['has-bg']}` : style.page} style={context.themeColor ? { '--primary-color': context.themeColor } : undefined}>
      <FillBackdrop src={backgroundSrc} />
      <div className={style.column}>
      <BannerSlides items={bannerList} />
      <header className={style.hero}>
        <div className={style['hero-inner']}>
          <div className={style['hero-bar']}>
            <span className={style['hero-badge']}>{badge}</span>
            {context.language === 'both' ? (
              <div className={style.lang}>
                <button type="button" className={locale === 'zh-CN' ? style['lang-on'] : ''} onClick={() => onSwitch('zh-CN')}>
                  中文
                </button>
                <button type="button" className={locale === 'en-US' ? style['lang-on'] : ''} onClick={() => onSwitch('en-US')}>
                  EN
                </button>
              </div>
            ) : null}
          </div>
          <Typography.Title level={2} className={style['hero-title']}>
            {context.name}
          </Typography.Title>
          {(context.description || '').trim() ? <div className={style['hero-notice']}>{context.description}</div> : null}
        </div>
      </header>
      <div className={style.content}>
        <div className={style.panel}>
          {context.status !== 'open' ? (
            <Result status="warning" title={formatMessage({ id: 'QuestionnaireFillClosed' })} subTitle={formatMessage({ id: 'QuestionnaireFillClosedDesc' })} />
          ) : done ? (
            <Result status="success" title={formatMessage({ id: 'QuestionnaireFillSubmittedTitle' })} subTitle={formatMessage({ id: 'QuestionnaireFillSubmittedDesc' })} />
          ) : (
            <SchemaHost locale={locale} schema={context.schema} onSubmit={submit} />
          )}
        </div>
      </div>
      </div>
    </div>
  );
  if (!context.themeColor) {
    return page;
  }
  return <ConfigProvider theme={{ token: { colorPrimary: context.themeColor } }}>{page}</ConfigProvider>;
});

const SchemaHost = createWithRemoteLoader({
  modules: ['components-thirdparty:FormCreator@SchemaRenderer']
})(({ remoteModules, locale, schema, onSubmit }) => {
  const [SchemaRenderer] = remoteModules;
  return (
    <SchemaRenderer
      locale={locale}
      schema={schema}
      formProps={{
        onSubmit
      }}
    />
  );
});

const QuestionnaireFill = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules }) => {
    const [usePreset] = remoteModules;
    const { ajax, apis, staticUrl } = usePreset();
    const { code } = useParams();
    const { formatMessage } = useIntl();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [context, setContext] = useState(null);
    const [done, setDone] = useState(false);
    const [fillLocale, setFillLocale] = useState('zh-CN');

    const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: resData } = await ajax(
          Object.assign({}, apis.questionnaire.publicDetail, {
            params: { code },
            showError: false
          })
        );
        if (resData.code !== 0) {
          setError(resData.msg || formatMessage({ id: 'QuestionnaireFillLoadFailed' }));
          return;
        }
        setContext(resData.data);
        setFillLocale(resolveFillLocale(resData.data?.language, code));
      } catch (err) {
        setError(err?.message || formatMessage({ id: 'QuestionnaireFillLoadFailed' }));
      } finally {
        setLoading(false);
      }
    }, [ajax, apis.questionnaire.publicDetail, code, formatMessage]);

    useEffect(() => {
      load();
    }, [load]);

    const switchLocale = next => {
      window.sessionStorage.setItem(storageKey(code), next);
      setFillLocale(next);
    };

    if (loading) {
      return (
        <div className={style.page}>
          <div className={style.loading}>
            <Spin size="large" />
          </div>
        </div>
      );
    }

    if (error || !context) {
      return (
        <div className={style.page}>
          <div className={style.content}>
            <Result status="error" title={formatMessage({ id: 'QuestionnaireFillLoadFailed' })} subTitle={error} />
          </div>
        </div>
      );
    }

    return (
      <FillContent
        staticUrl={staticUrl}
        locale={fillLocale}
        context={context}
        done={done}
        onSwitch={switchLocale}
        onSubmit={async answers => {
          const { data: resData } = await ajax(
            Object.assign({}, apis.questionnaire.publicSubmit, {
              data: { code, answers }
            })
          );
          if (resData.code !== 0) {
            return false;
          }
          setDone(true);
        }}
      />
    );
  })
);

export default QuestionnaireFill;
