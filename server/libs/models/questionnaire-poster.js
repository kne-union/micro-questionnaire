module.exports = ({ DataTypes }) => {
  return {
    model: {
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '所属用户'
      },
      projectId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '问卷项目'
      },
      html: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'AI 生成的海报 HTML，二维码、背景图以 {{qrcode}}、{{background}} 占位'
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '海报宽度 px'
      },
      height: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '海报高度 px'
      },
      requirement: {
        type: DataTypes.TEXT,
        defaultValue: '',
        comment: '生成时填写的要求'
      }
    },
    options: {
      comment: '问卷分享海报（AI 生成），每个项目最多保留 20 张',
      indexes: [
        {
          name: 'questionnaire_poster_project_key',
          fields: ['project_id', 'deleted_at']
        }
      ]
    }
  };
};
