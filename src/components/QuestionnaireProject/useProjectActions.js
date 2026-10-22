import ProjectAppearance from '../../pages/ProjectAppearance';
import ProjectShare, { createFooterSlot } from './ProjectShare';
import QuestionnaireFormInner from '@components/Questionnaire/QuestionnaireFormInner';
import { defaultProjectLanguage, normalizeTemplateLanguages, unpackProjectText } from '../../commons/schemaLanguages';
import { packProjectCreatePayload } from './projectForm';

const useProjectActions = ({ ajax, apis, appUrl, formModal, modal, message, formatMessage, navigate, onChanged, renderCreateForm }) => {
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
                languages: normalizeTemplateLanguages(formData.languages),
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
    const templateLanguages = normalizeTemplateLanguages(preset?.templateLanguages || preset?.languages);
    const language = preset?.language && ['zh-CN', 'en-US', 'both'].includes(preset.language) ? preset.language : defaultProjectLanguage(templateLanguages);
    const template = preset?.templateId
      ? { id: preset.templateId, name: preset.templateName || (typeof preset.name === 'string' ? preset.name : ''), languages: templateLanguages }
      : null;
    const nameParts = unpackProjectText(preset?.name, language);
    const descriptionParts = unpackProjectText(preset?.description, language);
    formModal({
      title: formatMessage({ id: preset?.copyFromId ? 'QuestionnaireProjectDuplicate' : 'QuestionnaireProjectCreate' }),
      size: 'default',
      formProps: {
        data: Object.assign(
          { language },
          template
            ? {
                templateId: template,
                name: nameParts.primary,
                nameEnUS: nameParts.secondary,
                description: descriptionParts.primary,
                descriptionEnUS: descriptionParts.secondary,
                background: preset.background ? [preset.background] : [],
                banners: preset.banners || [],
                themeColor: preset.themeColor || null
              }
            : {}
        ),
        onSubmit: async formData => {
          const { data: saveData } = await ajax(
            Object.assign({}, apis.questionnaire.projectCreate, {
              data: Object.assign({}, packProjectCreatePayload(formData), { copyFromId: preset?.copyFromId })
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

  const openShare = item => {
    const footerSlot = createFooterSlot();
    modal({
      zIndex: 1200,
      noPadding: true,
      footerButtons: [],
      footer: <div ref={footerSlot.ref} style={{ width: '100%' }} />,
      children: <ProjectShare data={item} url={appUrl.absolute(`/q/${item.code}`)} footerSlot={footerSlot} />
    });
    window.setTimeout(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }, 0);
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
        children: formatMessage({ id: 'QuestionnaireProjectShare' }),
        onClick: () => openShare(data)
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
            templateLanguages: data.templateLanguages || data.languages,
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
