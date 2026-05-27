const crypto = require('crypto');
const { query } = require('../config/db');
const { env } = require('../config/env');
const familyService = require('./family.service');
const familyRecipeService = require('./familyRecipe.service');

const TABLE_NAME = 'family_security_questions';
const MAX_FAILED_COUNT = 5;
const LOCK_MINUTES = 15;

const mockQuestions = new Map();

function createAuthError(message = '家庭码或密保答案不正确') {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

function createLockedError() {
  const error = new Error('密保验证失败次数过多，请稍后再试');
  error.statusCode = 423;
  return error;
}

function createForbiddenError(message = '只有家庭管理员可以设置密保问题') {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAnswer(value) {
  return normalizeText(value)
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function getEncryptionSecret() {
  if (env.securityQuestionEncryptionKey) {
    return env.securityQuestionEncryptionKey;
  }

  if (env.useMockDb || env.nodeEnv !== 'production') {
    return 'development-security-question-key';
  }

  throw new Error('请配置 SECURITY_QUESTION_ENCRYPTION_KEY');
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(getEncryptionSecret()).digest();
}

function encryptQuestion(question) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(question, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    questionCiphertext: ciphertext.toString('base64'),
    questionIv: iv.toString('base64'),
    questionAuthTag: authTag.toString('base64')
  };
}

function decryptQuestion(row) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(row.question_iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(row.question_auth_tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(row.question_ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function hashAnswer(answer, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(normalizeAnswer(answer), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyAnswer(answer, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':');

  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(normalizeAnswer(answer), salt, 32);
  const stored = Buffer.from(hash, 'hex');

  return stored.length === candidate.length && crypto.timingSafeEqual(candidate, stored);
}

function toQuestion(row, includeQuestion = true) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    familyCode: row.family_code,
    hasQuestion: true,
    question: includeQuestion ? decryptQuestion(row) : null,
    failedCount: row.failed_count || 0,
    lockedUntil: row.locked_until || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getQuestionRow(familyCode) {
  if (env.useMockDb) {
    return mockQuestions.get(familyCode) || null;
  }

  const rows = await query(
    `SELECT id, family_code, question_ciphertext, question_iv, question_auth_tag,
            answer_hash, failed_count, locked_until, created_by_device_id,
            updated_by_device_id, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE family_code = ?
     LIMIT 1`,
    [familyCode]
  );

  return rows[0] || null;
}

async function getPublicQuestion(familyCode) {
  const family = await familyService.getFamilyByCode(familyCode);
  const row = family ? await getQuestionRow(familyCode) : null;

  if (!row) {
    return {
      familyCode,
      hasQuestion: false,
      question: null
    };
  }

  const question = toQuestion(row);

  return {
    familyCode,
    hasQuestion: true,
    question: question.question
  };
}

async function setQuestionByDevice(deviceId, familyCode, question, answer) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  if (!member.isManager) {
    throw createForbiddenError();
  }

  const normalizedQuestion = normalizeText(question);
  const normalizedAnswer = normalizeAnswer(answer);

  if (!normalizedQuestion) {
    throw new TypeError('请填写密保问题');
  }

  if (!normalizedAnswer) {
    throw new TypeError('请填写密保答案');
  }

  const encrypted = encryptQuestion(normalizedQuestion);
  const answerHash = hashAnswer(normalizedAnswer);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const current = mockQuestions.get(familyCode);
    const row = {
      id: current?.id || mockQuestions.size + 1,
      family_code: familyCode,
      question_ciphertext: encrypted.questionCiphertext,
      question_iv: encrypted.questionIv,
      question_auth_tag: encrypted.questionAuthTag,
      answer_hash: answerHash,
      failed_count: 0,
      locked_until: null,
      created_by_device_id: current?.created_by_device_id || deviceId,
      updated_by_device_id: deviceId,
      created_at: current?.created_at || now,
      updated_at: now
    };
    mockQuestions.set(familyCode, row);
    return toQuestion(row);
  }

  await query(
    `INSERT INTO ${TABLE_NAME}
       (family_code, question_ciphertext, question_iv, question_auth_tag,
        answer_hash, failed_count, locked_until, created_by_device_id, updated_by_device_id)
     VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE
       question_ciphertext = VALUES(question_ciphertext),
       question_iv = VALUES(question_iv),
       question_auth_tag = VALUES(question_auth_tag),
       answer_hash = VALUES(answer_hash),
       failed_count = 0,
       locked_until = NULL,
       updated_by_device_id = VALUES(updated_by_device_id),
       updated_at = CURRENT_TIMESTAMP`,
    [
      familyCode,
      encrypted.questionCiphertext,
      encrypted.questionIv,
      encrypted.questionAuthTag,
      answerHash,
      deviceId,
      deviceId
    ]
  );

  const row = await getQuestionRow(familyCode);
  return toQuestion(row);
}

function isLocked(row) {
  return row.locked_until && Date.parse(row.locked_until) > Date.now();
}

async function recordFailedAttempt(row) {
  const failedCount = Number(row.failed_count || 0) + 1;
  const lockedUntil = failedCount >= MAX_FAILED_COUNT
    ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
    : null;

  if (env.useMockDb) {
    row.failed_count = failedCount;
    row.locked_until = lockedUntil ? lockedUntil.toISOString() : null;
    row.updated_at = new Date().toISOString();
    mockQuestions.set(row.family_code, row);
    return;
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET failed_count = ?,
         locked_until = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ?`,
    [failedCount, lockedUntil, row.family_code]
  );
}

async function resetFailedAttempts(familyCode) {
  if (env.useMockDb) {
    const row = mockQuestions.get(familyCode);
    if (row) {
      row.failed_count = 0;
      row.locked_until = null;
      row.updated_at = new Date().toISOString();
      mockQuestions.set(familyCode, row);
    }
    return;
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET failed_count = 0,
         locked_until = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ?`,
    [familyCode]
  );
}

async function recoverFamilyByAnswer(deviceId, familyCode, answer) {
  const row = await getQuestionRow(familyCode);
  const normalizedAnswer = normalizeAnswer(answer);

  if (!row || !normalizedAnswer) {
    throw createAuthError();
  }

  if (isLocked(row)) {
    throw createLockedError();
  }

  if (!verifyAnswer(normalizedAnswer, row.answer_hash)) {
    await recordFailedAttempt(row);
    throw createAuthError();
  }

  await resetFailedAttempts(familyCode);

  const family = await familyService.getFamilyByCode(familyCode);

  if (!family) {
    throw createAuthError();
  }

  const oldDeviceId = family.createdByDeviceId;
  const member = await familyRecipeService.bindDeviceToFamily(deviceId, familyCode, 'owner');
  const replacement = await familyService.replaceFamilyCreatorDevice(familyCode, deviceId);

  if (oldDeviceId && oldDeviceId !== deviceId) {
    await familyRecipeService.revokeFamilyMemberByDevice(oldDeviceId, familyCode);
  }

  const familySummary = await familyRecipeService.getFamilySummaryByDevice(deviceId);

  return {
    member,
    replacedDeviceId: replacement?.oldDeviceId || null,
    familyCodeList: familySummary.familyCodeList,
    families: familySummary.families,
    homeFamilyCode: familySummary.homeFamilyCode
  };
}

module.exports = {
  setQuestionByDevice,
  getPublicQuestion,
  recoverFamilyByAnswer
};
