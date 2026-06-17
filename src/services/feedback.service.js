const { query } = require('../config/db');
const { env } = require('../config/env');

const TABLE_NAME = 'feedbacks';
const DAILY_LIMIT = 5;
const CONTACT_MAX_LENGTH = 50;
const REPLY_MAX_LENGTH = 200;

const mockFeedbacks = new Map();
let lastIdTime = 0;
let idSequence = 0;

function createFeedbackId() {
  const now = Date.now();

  if (now === lastIdTime) {
    idSequence = (idSequence + 1) % 1000;
  } else {
    lastIdTime = now;
    idSequence = 0;
  }

  return now * 1000 + idSequence;
}

function createLimitError(message) {
  const error = new Error(message);
  error.statusCode = 429;
  return error;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toDateString(value) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const month = beijing.getUTCMonth() + 1;
  const day = beijing.getUTCDate();
  const hours = String(beijing.getUTCHours()).padStart(2, '0');
  const minutes = String(beijing.getUTCMinutes()).padStart(2, '0');

  return `${month}月${day}日 ${hours}:${minutes}`;
}

function toFeedback(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: row.type,
    content: row.content,
    contact: row.contact || '',
    date: toDateString(row.created_at),
    replied: Boolean(row.replied),
    replyText: row.reply_text || ''
  };
}

function getTodayPrefix(date = new Date()) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${beijing.getUTCFullYear()}-${String(beijing.getUTCMonth() + 1).padStart(2, '0')}-${String(beijing.getUTCDate()).padStart(2, '0')}`;
}

function getBeijingDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${beijing.getUTCFullYear()}-${String(beijing.getUTCMonth() + 1).padStart(2, '0')}-${String(beijing.getUTCDate()).padStart(2, '0')}`;
}

function isAllowedType(type) {
  return ['love', 'idea', 'bug'].includes(type);
}

async function countTodayFeedbacksByUser(userId) {
  if (env.useMockDb) {
    const prefix = getTodayPrefix();
    return Array.from(mockFeedbacks.values()).filter((row) => {
      return row.user_id === userId && getBeijingDayKey(row.created_at) === prefix;
    }).length;
  }

  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM ${TABLE_NAME}
     WHERE user_id = ?
       AND DATE(created_at) = CURRENT_DATE`,
    [userId]
  );

  return Number(rows?.[0]?.total || 0);
}

async function createFeedback(input = {}) {
  const userId = normalizeText(input.userId);
  const type = normalizeText(input.type);
  const content = normalizeText(input.content);
  const contact = normalizeText(input.contact);

  if (!userId) {
    const error = new Error('请先带上 user-id 或 device-id 再提交信件');
    error.statusCode = 400;
    throw error;
  }

  if (!isAllowedType(type)) {
    const error = new Error('反馈类型只能是 love、idea 或 bug');
    error.statusCode = 400;
    throw error;
  }

  if (!content) {
    const error = new Error('请填写信件内容');
    error.statusCode = 400;
    throw error;
  }

  if (content.length > 300) {
    const error = new Error('信件内容不能超过 300 个字符');
    error.statusCode = 400;
    throw error;
  }

  if (contact && contact.length > CONTACT_MAX_LENGTH) {
    const error = new Error(`联系方式不能超过 ${CONTACT_MAX_LENGTH} 个字符`);
    error.statusCode = 400;
    throw error;
  }

  const totalToday = await countTodayFeedbacksByUser(userId);

  if (totalToday >= DAILY_LIMIT) {
    throw createLimitError('今天投递信件次数已达上限，请明天再来');
  }

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const row = {
      id: createFeedbackId(),
      user_id: userId,
      type,
      content,
      contact: contact || null,
      reply_text: null,
      replied: 0,
      created_at: now
    };

    mockFeedbacks.set(row.id, row);
    return toFeedback(row);
  }

  await query(
    `INSERT INTO ${TABLE_NAME}
      (id, user_id, type, content, contact, reply_text, replied)
     VALUES (?, ?, ?, ?, ?, NULL, 0)`,
    [createFeedbackId(), userId, type, content, contact || null]
  );
  return null;
}

async function listFeedbackByUser(userId) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    const error = new Error('请先带上 user-id 或 device-id 再查看信箱');
    error.statusCode = 400;
    throw error;
  }

  if (env.useMockDb) {
    return Array.from(mockFeedbacks.values())
      .filter((row) => row.user_id === normalizedUserId)
      .sort((a, b) => {
        const aTime = Date.parse(a.created_at || 0) || 0;
        const bTime = Date.parse(b.created_at || 0) || 0;
        return bTime - aTime || b.id - a.id;
      })
      .map(toFeedback);
  }

  const rows = await query(
    `SELECT id, user_id, type, content, contact, reply_text, replied, created_at
     FROM ${TABLE_NAME}
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC`,
    [normalizedUserId]
  );

  return rows.map(toFeedback);
}

async function listAllFeedback() {
  if (env.useMockDb) {
    return Array.from(mockFeedbacks.values())
      .sort((a, b) => {
        const aTime = Date.parse(a.created_at || 0) || 0;
        const bTime = Date.parse(b.created_at || 0) || 0;
        return bTime - aTime || b.id - a.id;
      })
      .map(toFeedback);
  }

  const rows = await query(
    `SELECT id, user_id, type, content, contact, reply_text, replied, created_at
     FROM ${TABLE_NAME}
     ORDER BY created_at DESC, id DESC`
  );

  return rows.map(toFeedback);
}

async function getFeedbackById(feedbackId) {
  const id = Number(feedbackId);

  if (!Number.isFinite(id) || id <= 0) {
    const error = new Error('信件 ID 不正确');
    error.statusCode = 400;
    throw error;
  }

  if (env.useMockDb) {
    return toFeedback(mockFeedbacks.get(id));
  }

  const rows = await query(
    `SELECT id, user_id, type, content, contact, reply_text, replied, created_at
     FROM ${TABLE_NAME}
     WHERE id = ?`,
    [id]
  );

  return toFeedback(rows[0]);
}

async function replyFeedback(feedbackId, replyText) {
  const id = Number(feedbackId);
  const text = normalizeText(replyText);

  if (!Number.isFinite(id) || id <= 0) {
    const error = new Error('信件 ID 不正确');
    error.statusCode = 400;
    throw error;
  }

  if (!text) {
    const error = new Error('请填写回信内容');
    error.statusCode = 400;
    throw error;
  }

  if (text.length > REPLY_MAX_LENGTH) {
    const error = new Error(`回信内容不能超过 ${REPLY_MAX_LENGTH} 个字符`);
    error.statusCode = 400;
    throw error;
  }

  if (env.useMockDb) {
    const current = mockFeedbacks.get(id);

    if (!current) {
      throw createNotFoundError('信件不存在');
    }

    current.reply_text = text;
    current.replied = 1;
    mockFeedbacks.set(id, current);

    return toFeedback(current);
  }

  const current = await getFeedbackById(id);

  if (!current) {
    throw createNotFoundError('信件不存在');
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET reply_text = ?, replied = 1
     WHERE id = ?`,
    [text, id]
  );

  return getFeedbackById(id);
}

module.exports = {
  createFeedback,
  listFeedbackByUser,
  listAllFeedback,
  replyFeedback,
  getFeedbackById,
  countTodayFeedbacksByUser
};
