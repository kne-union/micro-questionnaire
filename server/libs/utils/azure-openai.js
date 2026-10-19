const { createAzure } = require('@ai-sdk/azure');

const getDeploymentName = (value, label) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    throw new Error(`${label} 未配置`);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error(`${label} 需要填写 Azure 部署名（例如 gpt-4o），不能填资源 URL`);
  }
  return trimmed;
};

const createChatModel = config => {
  if (!String(config.AZURE_OPENAI_API_KEY || '').trim()) {
    throw new Error('未配置 AZURE_OPENAI_API_KEY，无法生成问卷');
  }
  if (!String(config.AZURE_OPENAI_RESOURCE_NAME || '').trim() && !String(config.AZURE_OPENAI_BASE_URL || '').trim()) {
    throw new Error('请配置 AZURE_OPENAI_RESOURCE_NAME 或 AZURE_OPENAI_BASE_URL');
  }
  const azure = createAzure({
    resourceName: config.AZURE_OPENAI_RESOURCE_NAME,
    baseURL: config.AZURE_OPENAI_BASE_URL,
    apiKey: config.AZURE_OPENAI_API_KEY,
    apiVersion: config.AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
    useDeploymentBasedUrls: config.AZURE_OPENAI_USE_DEPLOYMENT_URLS !== 'false'
  });
  return azure.chat(getDeploymentName(config.AZURE_OPENAI_CHAT_DEPLOYMENT, 'AZURE_OPENAI_CHAT_DEPLOYMENT'));
};

module.exports = {
  createChatModel
};
