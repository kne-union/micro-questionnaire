module.exports = ({ DataTypes }) => {
  return {
    model: {
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '发起邀请的用户'
      },
      projectId: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: '问卷项目'
      },
      name: {
        type: DataTypes.STRING,
        defaultValue: '',
        comment: '被邀请人姓名'
      },
      email: {
        type: DataTypes.STRING,
        defaultValue: '',
        comment: '被邀请人邮箱'
      },
      phone: {
        type: DataTypes.STRING,
        defaultValue: '',
        comment: '被邀请人手机'
      },
      externalId: {
        type: DataTypes.STRING,
        comment: '调用方业务ID，回调时原样带回'
      },
      webhook: {
        type: DataTypes.TEXT,
        comment: '提交后回调地址（调用方自行在地址中携带校验参数）'
      },
      expiresAt: {
        type: DataTypes.DATE,
        comment: '邀请链接过期时间'
      },
      code: {
        type: DataTypes.STRING,
        comment: '邀请填写短码'
      },
      status: {
        type: DataTypes.ENUM('invited', 'submitted'),
        allowNull: false,
        defaultValue: 'invited',
        comment: 'invited 待填写，submitted 已提交'
      },
      responseId: {
        type: DataTypes.STRING,
        comment: '提交的答卷'
      },
      submittedAt: {
        type: DataTypes.DATE,
        comment: '提交时间'
      },
      webhookStatus: {
        type: DataTypes.STRING,
        comment: 'succeeded | failed'
      },
      webhookError: {
        type: DataTypes.TEXT,
        comment: '回调失败原因'
      }
    },
    options: {
      comment: '问卷定向邀请',
      indexes: [
        {
          name: 'questionnaire_invite_project_key',
          fields: ['project_id', 'deleted_at']
        }
      ]
    }
  };
};
