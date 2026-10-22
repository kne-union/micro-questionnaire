module.exports = ({ DataTypes }) => {
  return {
    model: {
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '所属用户'
      },
      templateId: {
        type: DataTypes.STRING,
        comment: '来源模版'
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '项目名称'
      },
      description: {
        type: DataTypes.TEXT,
        defaultValue: '',
        comment: '项目说明'
      },
      schema: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: '创建时从模版复制的问卷内容'
      },
      status: {
        type: DataTypes.ENUM('open', 'closed'),
        allowNull: false,
        defaultValue: 'open',
        comment: 'open 可填写，closed 已关闭'
      },
      language: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'both',
        comment: '填写语言：zh-CN、en-US、both'
      },
      background: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '填写页背景图 { id, filename }'
      },
      banners: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '填写页 Banner 列表'
      },
      themeColor: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: '填写页主题色，#RRGGBB'
      },
      posterBackground: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: '默认分享海报背景图 { id, filename }，为空时用填写页背景图'
      },
      code: {
        type: DataTypes.STRING,
        comment: '填写页短码'
      }
    },
    options: {
      comment: '问卷项目',
      indexes: [
        {
          name: 'questionnaire_project_user_key',
          fields: ['user_id', 'deleted_at']
        },
        {
          name: 'questionnaire_project_code_key',
          fields: ['code']
        }
      ]
    }
  };
};
