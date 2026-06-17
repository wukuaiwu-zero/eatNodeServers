const { env } = require('../config/env');
const feedbackService = require('../services/feedback.service');
const { getInput, normalizeText } = require('../utils/request');

const CONTENT_MAX_LENGTH = 300;
const CONTACT_MAX_LENGTH = 50;
const REPLY_MAX_LENGTH = 200;

function getUserId(req) {
  return normalizeText(
    getInput(req, 'user-id') ||
    getInput(req, 'userId') ||
    getInput(req, 'user_id') ||
    req.headers['x-user-id'] ||
    getInput(req, 'device-id') ||
    getInput(req, 'deviceId') ||
    req.headers['x-device-id']
  );
}

function getAdminToken(req) {
  const authorization = normalizeText(req.headers.authorization);

  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return normalizeText(
    req.headers['x-admin-token'] ||
    req.headers['admin-token'] ||
    getInput(req, 'adminToken')
  );
}

function requireAdminToken(req) {
  if (!env.adminFeedbackToken) {
    return null;
  }

  const token = getAdminToken(req);

  if (!token || token !== env.adminFeedbackToken) {
    const error = new Error('管理员 Token 校验失败');
    error.statusCode = 403;
    throw error;
  }

  return token;
}

async function submitFeedback(req, res, next) {
  try {
    const userId = getUserId(req);
    const type = normalizeText(req.body?.type);
    const content = normalizeText(req.body?.content);
    const contact = normalizeText(req.body?.contact);

    if (!userId) {
      return res.status(400).json({ message: '请先带上 user-id 或 device-id 再提交信件' });
    }

    if (!['love', 'idea', 'bug'].includes(type)) {
      return res.status(400).json({ message: '反馈类型只能是 love、idea 或 bug' });
    }

    if (!content) {
      return res.status(400).json({ message: '请填写信件内容' });
    }

    if (content.length > CONTENT_MAX_LENGTH) {
      return res.status(400).json({ message: `信件内容不能超过 ${CONTENT_MAX_LENGTH} 个字符` });
    }

    if (contact && contact.length > CONTACT_MAX_LENGTH) {
      return res.status(400).json({ message: `联系方式不能超过 ${CONTACT_MAX_LENGTH} 个字符` });
    }

    await feedbackService.createFeedback({
      userId,
      type,
      content,
      contact: contact || undefined
    });

    return res.json({
      code: 200,
      msg: '信件已成功投入邮筒',
      message: '信件已成功投入邮筒'
    });
  } catch (error) {
    return next(error);
  }
}

async function listMyFeedback(req, res, next) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(400).json({ message: '请先带上 user-id 或 device-id 再查看信箱' });
    }

    const data = await feedbackService.listFeedbackByUser(userId);

    return res.json({
      code: 200,
      data
    });
  } catch (error) {
    return next(error);
  }
}

async function listAdminFeedback(req, res, next) {
  try {
    requireAdminToken(req);

    const data = await feedbackService.listAllFeedback();

    return res.json({
      code: 200,
      data
    });
  } catch (error) {
    return next(error);
  }
}

async function replyFeedback(req, res, next) {
  try {
    requireAdminToken(req);

    const feedbackId = Number(req.body?.feedbackId || getInput(req, 'feedbackId'));
    const replyText = normalizeText(req.body?.replyText);

    if (!Number.isFinite(feedbackId) || feedbackId <= 0) {
      return res.status(400).json({ message: '请填写正确的信件 ID' });
    }

    if (!replyText) {
      return res.status(400).json({ message: '请填写回信内容' });
    }

    if (replyText.length > REPLY_MAX_LENGTH) {
      return res.status(400).json({ message: `回信内容不能超过 ${REPLY_MAX_LENGTH} 个字符` });
    }

    await feedbackService.replyFeedback(feedbackId, replyText);

    return res.json({
      code: 200,
      msg: '回信成功寄出',
      message: '回信成功寄出'
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  submitFeedback,
  listMyFeedback,
  listAdminFeedback,
  replyFeedback
};
