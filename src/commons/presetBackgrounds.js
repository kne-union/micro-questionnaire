const presetBackgrounds = [
  { key: 'blue', labelId: 'QuestionnairePresetBackgroundBlue' },
  { key: 'warm', labelId: 'QuestionnairePresetBackgroundWarm' },
  { key: 'green', labelId: 'QuestionnairePresetBackgroundGreen' },
  { key: 'tech', labelId: 'QuestionnairePresetBackgroundTech' },
  { key: 'sky', labelId: 'QuestionnairePresetBackgroundSky' },
  { key: 'festive', labelId: 'QuestionnairePresetBackgroundFestive' },
  { key: 'paper', labelId: 'QuestionnairePresetBackgroundPaper' },
  { key: 'ocean', labelId: 'QuestionnairePresetBackgroundOcean' }
];

export const presetBackgroundUrl = (appUrl, key) => appUrl.asset(`/backgrounds/${key}.jpg`);

export const presetBackgroundFilename = key => `preset-${key}.jpg`;

export const matchPresetBackground = image => presetBackgrounds.find(item => image?.filename === presetBackgroundFilename(item.key)) || null;

// 常用背景是应用自带的静态图，选中时上传成文件记录，后续与用户上传的背景走同一套存储与展示
export const uploadPresetBackground = async ({ appUrl, apis, key }) => {
  const response = await fetch(presetBackgroundUrl(appUrl, key));
  if (!response.ok) {
    return null;
  }
  const blob = await response.blob();
  const file = new File([blob], presetBackgroundFilename(key), { type: blob.type || 'image/jpeg' });
  const result = await apis.file.upload({ file });
  const body = result?.data;
  if (!body || body.code !== 0 || !body.data?.id) {
    return null;
  }
  return { id: body.data.id, filename: presetBackgroundFilename(key) };
};

export default presetBackgrounds;
