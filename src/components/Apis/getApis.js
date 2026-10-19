import getSampleApis from '@components/Sample/getApis';

const prefix = '/api/v1';

const questionnaire = {
  templateList: {
    url: `${prefix}/questionnaire/template/list`,
    method: 'GET'
  },
  templateDetail: {
    url: `${prefix}/questionnaire/template/detail`,
    method: 'GET'
  },
  templateSave: {
    url: `${prefix}/questionnaire/template/save`,
    method: 'POST'
  },
  templateRemove: {
    url: `${prefix}/questionnaire/template/remove`,
    method: 'POST'
  },
  templateGenerate: {
    url: `${prefix}/questionnaire/template/generate`,
    method: 'POST'
  },
  projectList: {
    url: `${prefix}/questionnaire/project/list`,
    method: 'GET'
  },
  projectDetail: {
    url: `${prefix}/questionnaire/project/detail`,
    method: 'GET'
  },
  projectCreate: {
    url: `${prefix}/questionnaire/project/create`,
    method: 'POST'
  },
  projectAppearance: {
    url: `${prefix}/questionnaire/project/appearance`,
    method: 'POST'
  },
  projectClose: {
    url: `${prefix}/questionnaire/project/close`,
    method: 'POST'
  },
  projectOpen: {
    url: `${prefix}/questionnaire/project/open`,
    method: 'POST'
  },
  responseList: {
    url: `${prefix}/questionnaire/project/response/list`,
    method: 'GET'
  },
  projectExport: {
    url: `${prefix}/questionnaire/project/export`,
    method: 'GET'
  },
  publicDetail: {
    url: `${prefix}/questionnaire/public/detail`,
    method: 'GET'
  },
  publicSubmit: {
    url: `${prefix}/questionnaire/public/submit`,
    method: 'POST'
  }
};

export default () => ({
  sample: getSampleApis(),
  questionnaire
});
