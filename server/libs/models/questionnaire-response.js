module.exports = ({ DataTypes }) => {
  return {
    model: {
      projectId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '问卷项目'
      },
      answers: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '答卷'
      },
      submittedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '提交时间'
      }
    },
    options: {
      comment: '问卷答卷',
      indexes: [
        {
          name: 'questionnaire_response_project_key',
          fields: ['project_id', 'deleted_at']
        }
      ]
    }
  };
};
