const unwrapPayload = resData => {
  if (resData && typeof resData === 'object' && 'code' in resData) {
    if (resData.code !== 0) {
      const err = new Error(resData.msg || resData.message || 'request_failed');
      err.code = resData.code;
      throw err;
    }
    return resData.data;
  }
  return resData;
};

const buildFormCreatorApis = ({ ajax, templateApis, locale }) => ({
  list: async () => {
    const { data: resData } = await ajax(
      Object.assign({}, templateApis.templateList, {
        params: { perPage: 1000, currentPage: 1, locale }
      })
    );
    const payload = unwrapPayload(resData);
    return (payload?.pageData || []).map(item => ({
      id: item.id,
      name: item.name,
      schema: item.schema
    }));
  },
  get: async ({ params, data } = {}) => {
    const id = params?.id || data?.id;
    const { data: resData } = await ajax(
      Object.assign({}, templateApis.templateDetail, {
        params: { id, locale }
      })
    );
    const payload = unwrapPayload(resData);
    return { id: payload.id, name: payload.name, schema: payload.schema };
  },
  saveTemplate: async ({ data } = {}) => {
    const { data: resData } = await ajax(
      Object.assign({}, templateApis.templateSave, {
        data: {
          name: data.name,
          schema: data.schema
        }
      })
    );
    return unwrapPayload(resData);
  }
});

export default buildFormCreatorApis;
