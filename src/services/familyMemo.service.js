const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

const TABLE_NAME = 'family_memos';

const mockMemos = new Map();

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createMemoId() {
  return `memo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getMockKey(familyCode, memoId) {
  return `${familyCode}:${memoId}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTimeValue(value) {
  function formatBeijingTime(date) {
    const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return `${beijingTime.toISOString().slice(0, -1)}+08:00`;
  }

  if (value instanceof Date) {
    return formatBeijingTime(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatBeijingTime(new Date(value));
  }

  if (typeof value === 'string') {
    const text = value.trim();
    const numeric = Number(text);

    if (Number.isFinite(numeric) && text) {
      return formatBeijingTime(new Date(numeric));
    }

    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) {
      return formatBeijingTime(new Date(parsed));
    }
  }

  return null;
}

function normalizeMemo(memoJson) {
  if (memoJson === undefined || memoJson === null) {
    throw new TypeError('请填写备忘录数据');
  }

  const memo = typeof memoJson === 'string' ? JSON.parse(memoJson) : { ...memoJson };

  if (!memo || typeof memo !== 'object' || Array.isArray(memo)) {
    throw new TypeError('备忘录数据格式不正确');
  }

  const memoId = normalizeText(memo.id || memo._id || memo.memoId) || createMemoId();
  const content = normalizeText(memo.content || memo.text || memo.title);
  const createTime = Number(memo.create_time || memo.createTime || memo.timestamp || Date.now());

  if (!memoId) {
    throw new TypeError('备忘录 id 不能为空');
  }

  if (!content) {
    throw new TypeError('备忘录内容不能为空');
  }

  return {
    memoId,
    content,
    createTime: Number.isFinite(createTime) ? createTime : Date.now()
  };
}

function toMemo(row) {
  if (!row) {
    return null;
  }

  const createTime = normalizeTimeValue(row.create_time);

  return {
    id: row.memo_id,
    _id: row.memo_id,
    memoId: row.memo_id,
    family_id: row.family_code,
    familyCode: row.family_code,
    family_code: row.family_code,
    content: row.content,
    create_time: createTime,
    createTime,
    timestamp: createTime,
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function upsertMemo(familyCode, memberCode, memoJson) {
  const normalized = normalizeMemo(memoJson);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const key = getMockKey(familyCode, normalized.memoId);
    const current = mockMemos.get(key);
    const row = {
      id: current?.id || mockMemos.size + 1,
      memo_id: normalized.memoId,
      family_code: familyCode,
      content: normalized.content,
      create_time: normalized.createTime,
      created_by: current?.created_by || memberCode,
      updated_by: memberCode,
      version: (current?.version || 0) + 1,
      deleted_at: null,
      created_at: current?.created_at || now,
      updated_at: now
    };

    mockMemos.set(key, row);
    return toMemo(row);
  }

  await query(
    `INSERT INTO ${TABLE_NAME}
       (memo_id, family_code, content, create_time, created_by, updated_by, version)
     VALUES (?, ?, ?, FROM_UNIXTIME(? / 1000), ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       content = VALUES(content),
       create_time = VALUES(create_time),
       updated_by = VALUES(updated_by),
       version = version + 1,
       deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      normalized.memoId,
      familyCode,
      normalized.content,
      normalized.createTime,
      memberCode,
      memberCode
    ]
  );

  return getMemoByFamily(familyCode, normalized.memoId);
}

async function upsertMemoByDevice(deviceId, familyCode, memoJson) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const memo = await upsertMemo(member.familyCode, member.memberCode, memoJson);
  return { member, memo };
}

async function getMemoByFamily(familyCode, memoId) {
  if (env.useMockDb) {
    return toMemo(mockMemos.get(getMockKey(familyCode, memoId)));
  }

  const rows = await query(
    `SELECT id, memo_id, family_code, content, create_time, version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE family_code = ? AND memo_id = ?`,
    [familyCode, memoId]
  );

  return toMemo(rows[0]);
}

async function getMemoByDevice(deviceId, familyCode, memoId) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const memo = await getMemoByFamily(member.familyCode, memoId);
  return { member, memo };
}

async function listMemosByFamily(familyCode, options = {}) {
  const includeDeleted = Boolean(options.includeDeleted);

  if (env.useMockDb) {
    return Array.from(mockMemos.values())
      .filter((row) => row.family_code === familyCode)
      .filter((row) => includeDeleted || !row.deleted_at)
      .sort((a, b) => {
        if ((a.create_time || 0) === (b.create_time || 0)) {
          return a.id - b.id;
        }
        return (b.create_time || 0) - (a.create_time || 0);
      })
      .map(toMemo);
  }

  const filters = ['family_code = ?'];
  const params = [familyCode];

  if (!includeDeleted) {
    filters.push('deleted_at IS NULL');
  }

  const rows = await query(
    `SELECT id, memo_id, family_code, content, create_time, version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE ${filters.join(' AND ')}
     ORDER BY create_time DESC, id DESC`,
    params
  );

  return rows.map(toMemo);
}

async function listMemosByDevice(deviceId, options = {}) {
  const familyCode = normalizeText(options.familyCode || options.family_code);
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);

  if (!member) {
    return null;
  }

  const memos = await listMemosByFamily(member.familyCode, options);
  return { member, memos };
}

async function deleteMemoByFamily(familyCode, memoId, memberCode) {
  const memo = await getMemoByFamily(familyCode, memoId);

  if (!memo || memo.deleted) {
    return null;
  }

  if (env.useMockDb) {
    const key = getMockKey(familyCode, memoId);
    const current = mockMemos.get(key);
    current.deleted_at = new Date().toISOString();
    current.updated_by = memberCode;
    current.version += 1;
    current.updated_at = current.deleted_at;
    mockMemos.set(key, current);
    return toMemo(current);
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_by = ?,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND memo_id = ? AND deleted_at IS NULL`,
    [memberCode, familyCode, memoId]
  );

  return getMemoByFamily(familyCode, memoId);
}

async function deleteMemoByDevice(deviceId, familyCode, memoId) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const memo = await deleteMemoByFamily(member.familyCode, memoId, member.memberCode);

  if (!memo) {
    throw createNotFoundError('备忘录不存在');
  }

  return { member, memo };
}

module.exports = {
  upsertMemoByDevice,
  getMemoByDevice,
  listMemosByDevice,
  deleteMemoByDevice,
  listMemosByFamily
};
