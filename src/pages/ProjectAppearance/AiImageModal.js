import { App, Button, Input, Modal, Space, Spin } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { useIntl } from '@kne/react-intl';
import { HtmlImagePreview, exportHtmlImage, renderSafeHtml } from '@components/Questionnaire/HtmlImage';
import style from './style.module.scss';

const AiImageModal = ({ kind, projectId, ajax, apis, onCancel, onApply }) => {
  const { formatMessage, locale } = useIntl();
  const { message } = App.useApp();
  const nodeRef = useRef(null);
  const [requirement, setRequirement] = useState('');
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const html = useMemo(() => (result ? renderSafeHtml(result.html) : ''), [result]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: resData } = await ajax(
        Object.assign({}, apis.questionnaire.projectAppearanceGenerate, {
          data: { id: projectId, kind, requirement, locale: locale === 'en-US' ? 'en-US' : 'zh-CN' }
        })
      );
      if (resData.code === 0 && resData.data?.html) {
        setResult(resData.data);
      }
    } finally {
      setGenerating(false);
    }
  };

  const apply = async () => {
    if (!nodeRef.current || !result) {
      return;
    }
    setApplying(true);
    try {
      const dataUrl = await exportHtmlImage(nodeRef.current, { width: result.width, height: result.height, type: 'jpeg' });
      const blob = await (await fetch(dataUrl)).blob();
      await onApply(new File([blob], `ai-${kind}-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    } catch (error) {
      console.error(error);
      message.error(formatMessage({ id: 'QuestionnaireAiImageApplyFailed' }));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      open
      zIndex={1300}
      width={720}
      title={formatMessage({ id: kind === 'banner' ? 'QuestionnaireProjectAppearanceAiBanner' : 'QuestionnaireProjectAppearanceAiBackground' })}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>{formatMessage({ id: 'QuestionnaireAiImageCancel' })}</Button>
          <Button type="primary" disabled={!html || generating} loading={applying} onClick={apply}>
            {formatMessage({ id: 'QuestionnaireAiImageApply' })}
          </Button>
        </Space>
      }
    >
      <div className={style['ai-image']}>
        <Input.TextArea
          value={requirement}
          maxLength={2000}
          autoSize={{ minRows: 2, maxRows: 5 }}
          placeholder={formatMessage({ id: kind === 'banner' ? 'QuestionnaireAiImageBannerPlaceholder' : 'QuestionnaireAiImageBackgroundPlaceholder' })}
          onChange={event => setRequirement(event.target.value)}
        />
        <Button loading={generating} onClick={generate}>
          {formatMessage({ id: result ? 'QuestionnaireAiImageRegenerate' : 'QuestionnaireAiImageGenerate' })}
        </Button>
        <Spin spinning={generating}>
          {html ? <HtmlImagePreview html={html} width={result.width} height={result.height} nodeRef={nodeRef} maxHeight={360} /> : <div className={style['ai-image-empty']}>{formatMessage({ id: 'QuestionnaireAiImageEmpty' })}</div>}
        </Spin>
      </div>
    </Modal>
  );
};

export default AiImageModal;
