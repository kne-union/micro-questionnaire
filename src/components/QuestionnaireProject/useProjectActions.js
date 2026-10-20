import ProjectAppearance from '../../pages/ProjectAppearance';
import QuestionnaireFormInner from '@components/Questionnaire/QuestionnaireFormInner';
import { withPublicUrl } from '../../commons/publicUrl';

const fillUrl = code => `${window.location.origin}${withPublicUrl(`/q/${code}`)}`;

const appearanceData = formData => ({
  background: formData.background || [],
  banners: formData.banners || [],
  themeColor: formData.themeColor || null
});

const useProjectActions = ({ ajax, apis, formModal, modal, message, formatMessage, navigate, onChanged, renderCreateForm }) => {
  const openCreateTemplate = (reloadList, openApi) => {
    formModal({
      title: formatMessage({ id: 'QuestionnaireTemplateCreate' }),
      size: 'large',
      formProps: {
        onSubmit: async formData => {
          const { data: resData } = await ajax(
            Object.assign({}, apis.questionnaire.templateSave, {
              data: {
                name: formData.name,
                description: formData.description || '',
                schema: formData.schema
              }
            })
          );
          if (resData.code !== 0) {
            return false;
          }
          const created = resData.data || {};
          const fields = [{ name: 'templateId', value: created }];
          if (!openApi.formData?.name && created.name) {
            fields.push({ name: 'name', value: created.name });
          }
          if (!openApi.formData?.description && created.description) {
            fields.push({ name: 'description', value: created.description });
          }
          openApi.setFields(fields);
          reloadList();
          message.success(formatMessage({ id: 'QuestionnaireTemplateCreateSuccess' }));
        }
      },
      children: <QuestionnaireFormInner templateApis={apis.questionnaire} />
    });
  };

  const openCreate = preset => {
    const template = preset?.templateId ? { id: preset.templateId, name: preset.templateName || preset.name || '' } : null;
    formModal({
      title: formatMessage({ id: preset?.copyFromId ? 'QuestionnaireProjectDuplicate' : 'QuestionnaireProjectCreate' }),
      size: 'default',
      formProps: {
        data: Object.assign(
          { language: preset?.language || 'both' },
          template
            ? {
                templateId: template,
                name: preset.name || '',
                description: preset.description || '',
                background: preset.background ? [preset.background] : [],
                banners: preset.banners || [],
                themeColor: preset.themeColor || null
              }
            : {}
        ),
        onSubmit: async formData => {
          const templateId = formData.templateId?.id || formData.templateId;
          const { data: saveData } = await ajax(
            Object.assign({}, apis.questionnaire.projectCreate, {
              data: {
                templateId,
                name: formData.name,
                description: formData.description || '',
                language: formData.language || 'both',
                copyFromId: preset?.copyFromId,
                ...appearanceData(formData)
              }
            })
          );
          if (saveData.code !== 0) {
            return false;
          }
          message.success(formatMessage({ id: 'QuestionnaireProjectCreateSuccess' }));
          onChanged && onChanged();
        }
      },
      children: renderCreateForm(openCreateTemplate)
    });
  };

  const openAppearance = item => {
    modal({
      title: formatMessage({ id: 'QuestionnaireProjectAppearance' }),
      size: 'large',
      zIndex: 1200,
      footer: null,
      noPadding: true,
      children: <ProjectAppearance projectId={item.id} />
    });
    window.setTimeout(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }, 0);
  };

  const copyLink = async item => {
    const url = fillUrl(item.code);
    try {
      await navigator.clipboard.writeText(url);
      message.success(formatMessage({ id: 'QuestionnaireProjectCopySuccess' }));
    } catch (error) {
      message.info(url);
    }
  };

  const closeProject = async (item, onSuccess) => {
    const { data: resData } = await ajax(
      Object.assign({}, apis.questionnaire.projectClose, {
        data: { id: item.id }
      })
    );
    if (resData.code !== 0) {
      return;
    }
    message.success(formatMessage({ id: 'QuestionnaireProjectCloseSuccess' }));
    onSuccess && onSuccess();
  };

  const openProject = async (item, onSuccess) => {
    const { data: resData } = await ajax(
      Object.assign({}, apis.questionnaire.projectOpen, {
        data: { id: item.id }
      })
    );
    if (resData.code !== 0) {
      return;
    }
    message.success(formatMessage({ id: 'QuestionnaireProjectReopenSuccess' }));
    onSuccess && onSuccess();
  };

  const getActionList = ({ data, onSuccess, ...actionProps }) =>
    [
      {
        ...actionProps,
        data,
        children: formatMessage({ id: 'QuestionnaireProjectCopy' }),
        onClick: () => copyLink(data)
      },
      {
        ...actionProps,
        data,
        children: formatMessage({ id: 'QuestionnaireProjectDuplicate' }),
        onClick: () =>
          openCreate({
            copyFromId: data.id,
            templateId: data.templateId,
            templateName: data.templateName,
            name: data.name,
            description: data.description,
            language: data.language,
            background: data.background,
            banners: data.banners,
            themeColor: data.themeColor
          })
      },
      {
        ...actionProps,
        data,
        children: formatMessage({ id: 'QuestionnaireProjectAppearance' }),
        onClick: () => openAppearance(data)
      },
      {
        ...actionProps,
        data,
        children: formatMessage({ id: 'QuestionnaireProjectResults' }),
        onClick: () => navigate(`/project/${data.id}/results`)
      },
      data.status === 'open'
        ? {
            ...actionProps,
            data,
            children: formatMessage({ id: 'QuestionnaireProjectClose' }),
            confirm: true,
            message: formatMessage({ id: 'QuestionnaireProjectCloseConfirm' }),
            onClick: () => closeProject(data, onSuccess)
          }
        : {
            ...actionProps,
            data,
            children: formatMessage({ id: 'QuestionnaireProjectReopen' }),
            confirm: true,
            message: formatMessage({ id: 'QuestionnaireProjectReopenConfirm' }),
            onClick: () => openProject(data, onSuccess)
          }
    ].filter(Boolean);

  return { openCreate, openCreateTemplate, getActionList };
};

export default useProjectActions;
