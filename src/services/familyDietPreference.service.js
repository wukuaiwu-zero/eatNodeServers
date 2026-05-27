const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

const TABLE_NAME = 'family_diet_preferences';
const PREFERENCE_TYPES = new Set(['family_taste', 'avoid_food']);
const TYPE_LABELS = {
  family_taste: '全家口味',
  avoid_food: '忌口不吃'
};
const TYPE_ALIASES = {
  family_taste: 'family_taste',
  familyTaste: 'family_taste',
  taste: 'family_taste',
  '全家口味': 'family_taste',
  avoid_food: 'avoid_food',
  avoidFood: 'avoid_food',
  avoid: 'avoid_food',
  taboo: 'avoid_food',
  '忌口不吃': 'avoid_food'
};

const mockPreferences = new Map();

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createPreferenceId() {
  return `pref_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getMockKey(familyCode, preferenceId) {
  return `${familyCode}:${preferenceId}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePreferenceType(value) {
  const text = normalizeText(value);
  const normalized = TYPE_ALIASES[text] || text;

  if (!PREFERENCE_TYPES.has(normalized)) {
    throw new TypeError('偏好类型只能是全家口味或忌口不吃');
  }

  return normalized;
}

function normalizePreference(preferenceJson) {
  if (preferenceJson === undefined || preferenceJson === null) {
    throw new TypeError('请填写饮食偏好数据');
  }

  const preference = typeof preferenceJson === 'string' ? JSON.parse(preferenceJson) : { ...preferenceJson };

  if (!preference || typeof preference !== 'object' || Array.isArray(preference)) {
    throw new TypeError('饮食偏好数据格式不正确');
  }

  const preferenceId = normalizeText(preference.id || preference._id || preference.preferenceId)
    || createPreferenceId();
  const title = normalizeText(preference.title || preference.name);
  const preferenceType = normalizePreferenceType(
    preference.preferenceType || preference.preference_type || preference.type
  );

  if (!preferenceId) {
    throw new TypeError('饮食偏好 id 不能为空');
  }

  if (!title) {
    throw new TypeError('饮食偏好标题不能为空');
  }

  return {
    preferenceId,
    title,
    preferenceType
  };
}

function toPreference(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.preference_id,
    _id: row.preference_id,
    preferenceId: row.preference_id,
    familyCode: row.family_code,
    family_code: row.family_code,
    title: row.title,
    preferenceType: row.preference_type,
    preference_type: row.preference_type,
    type: row.preference_type,
    typeLabel: TYPE_LABELS[row.preference_type] || row.preference_type,
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function upsertPreference(familyCode, memberCode, preferenceJson) {
  const normalized = normalizePreference(preferenceJson);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const key = getMockKey(familyCode, normalized.preferenceId);
    const current = mockPreferences.get(key);
    const row = {
      id: current?.id || mockPreferences.size + 1,
      preference_id: normalized.preferenceId,
      family_code: familyCode,
      title: normalized.title,
      preference_type: normalized.preferenceType,
      created_by: current?.created_by || memberCode,
      updated_by: memberCode,
      version: (current?.version || 0) + 1,
      deleted_at: null,
      created_at: current?.created_at || now,
      updated_at: now
    };

    mockPreferences.set(key, row);
    return toPreference(row);
  }

  await query(
    `INSERT INTO ${TABLE_NAME}
       (preference_id, family_code, title, preference_type, created_by, updated_by, version)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       preference_type = VALUES(preference_type),
       updated_by = VALUES(updated_by),
       version = version + 1,
       deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      normalized.preferenceId,
      familyCode,
      normalized.title,
      normalized.preferenceType,
      memberCode,
      memberCode
    ]
  );

  return getPreferenceByFamily(familyCode, normalized.preferenceId);
}

async function upsertPreferenceByDevice(deviceId, familyCode, preferenceJson) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const preference = await upsertPreference(member.familyCode, member.memberCode, preferenceJson);
  return { member, preference };
}

async function getPreferenceByFamily(familyCode, preferenceId) {
  if (env.useMockDb) {
    return toPreference(mockPreferences.get(getMockKey(familyCode, preferenceId)));
  }

  const rows = await query(
    `SELECT id, preference_id, family_code, title, preference_type, version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE family_code = ? AND preference_id = ?`,
    [familyCode, preferenceId]
  );

  return toPreference(rows[0]);
}

async function getPreferenceByDevice(deviceId, familyCode, preferenceId) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const preference = await getPreferenceByFamily(member.familyCode, preferenceId);
  return { member, preference };
}

async function listPreferencesByFamily(familyCode, options = {}) {
  const includeDeleted = Boolean(options.includeDeleted);
  const preferenceTypeInput = normalizeText(options.preferenceType || options.preference_type || options.type);
  const preferenceType = preferenceTypeInput ? normalizePreferenceType(preferenceTypeInput) : null;

  if (env.useMockDb) {
    return Array.from(mockPreferences.values())
      .filter((row) => row.family_code === familyCode)
      .filter((row) => includeDeleted || !row.deleted_at)
      .filter((row) => !preferenceType || row.preference_type === preferenceType)
      .sort((a, b) => a.id - b.id)
      .map(toPreference);
  }

  const filters = ['family_code = ?'];
  const params = [familyCode];

  if (!includeDeleted) {
    filters.push('deleted_at IS NULL');
  }

  if (preferenceType) {
    filters.push('preference_type = ?');
    params.push(preferenceType);
  }

  const rows = await query(
    `SELECT id, preference_id, family_code, title, preference_type, version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE ${filters.join(' AND ')}
     ORDER BY id ASC`,
    params
  );

  return rows.map(toPreference);
}

async function listPreferencesByDevice(deviceId, options = {}) {
  const familyCode = normalizeText(options.familyCode || options.family_code);
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);

  if (!member) {
    return null;
  }

  const preferences = await listPreferencesByFamily(member.familyCode, options);
  return { member, preferences };
}

async function deletePreferenceByFamily(familyCode, preferenceId, memberCode) {
  const preference = await getPreferenceByFamily(familyCode, preferenceId);

  if (!preference || preference.deleted) {
    return null;
  }

  if (env.useMockDb) {
    const key = getMockKey(familyCode, preferenceId);
    const current = mockPreferences.get(key);
    current.deleted_at = new Date().toISOString();
    current.updated_by = memberCode;
    current.version += 1;
    current.updated_at = current.deleted_at;
    mockPreferences.set(key, current);
    return toPreference(current);
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_by = ?,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND preference_id = ? AND deleted_at IS NULL`,
    [memberCode, familyCode, preferenceId]
  );

  return getPreferenceByFamily(familyCode, preferenceId);
}

async function deletePreferenceByDevice(deviceId, familyCode, preferenceId) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const preference = await deletePreferenceByFamily(member.familyCode, preferenceId, member.memberCode);

  if (!preference) {
    throw createNotFoundError('饮食偏好不存在');
  }

  return { member, preference };
}

module.exports = {
  upsertPreferenceByDevice,
  getPreferenceByDevice,
  listPreferencesByDevice,
  listPreferencesByFamily,
  deletePreferenceByDevice
};
