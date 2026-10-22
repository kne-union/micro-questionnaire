module.exports = ({ DataTypes }) => {
  return {
    model: {
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '所属用户'
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '模版名称'
      },
      description: {
        type: DataTypes.TEXT,
        defaultValue: '',
        comment: '模版说明'
      },
      schema: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'FormCreator schema'
      },
      languages: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '支持的语言，如 ["zh-CN","en-US"]，为空按中文'
      },
      builtinKey: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '内置默认模版标识，用户自建模版为空'
      }
    },
    options: {
      comment: '问卷模版，按用户隔离',
      indexes: [
        {
          name: 'questionnaire_template_user_key',
          fields: ['user_id', 'deleted_at']
        }
      ]
    }
  };
};
