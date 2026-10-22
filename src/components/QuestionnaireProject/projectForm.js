import { packProjectText } from '../../commons/schemaLanguages';

const appearanceData = formData => ({
  background: formData.background || [],
  banners: formData.banners || [],
  themeColor: formData.themeColor || null
});

export const packProjectCreatePayload = formData => {
  const language = formData.language || 'both';
  return {
    templateId: formData.templateId?.id || formData.templateId,
    name: packProjectText(formData, language, 'name'),
    description: packProjectText(formData, language, 'description'),
    language,
    ...appearanceData(formData)
  };
};
