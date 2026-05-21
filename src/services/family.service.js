const crypto = require('crypto');
const { query } = require('../config/db');
const { env } = require('../config/env');
const deviceService = require('./device.service');

const mockFamilies = new Map();
const mockInvites = new Map();
const mockFamilyAccess = new Set();

function createConflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createForbiddenError(message = '当前设备没有这个家庭的访问权限') {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function createFamilyCode() {
  return `fam_${crypto.randomBytes(8).toString('hex')}`;
}

function createInviteCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function getAccessKey(deviceId, familyCode) {
  return `${deviceId}:${familyCode}`;
}

function toFamily(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    familyCode: row.family_code,
    familyName: row.family_name,
    avatarUrl: row.avatar_url || null,
    isDeleted: Boolean(row.is_deleted),
    createdByDeviceId: row.created_by_device_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createFamily(familyCode, familyName = null, options = {}) {
  if (env.useMockDb) {
    const current = mockFamilies.get(familyCode);

    if (current) {
      throw createConflictError('这个家庭码已经被使用');
    }

    const now = new Date().toISOString();
    const row = {
      id: mockFamilies.size + 1,
      family_code: familyCode,
      family_secret_hash: options.familySecret
        ? deviceService.hashSecret(options.familySecret)
        : null,
      family_name: familyName,
      avatar_url: options.avatarUrl || null,
      is_deleted: 0,
      created_by_device_id: options.deviceId || null,
      created_at: now,
      updated_at: now
    };

    mockFamilies.set(familyCode, row);
    return toFamily(row);
  }

  const rows = await query(
    `SELECT id
     FROM families
     WHERE family_code = ?`,
    [familyCode]
  );

  if (rows[0]) {
    throw createConflictError('这个家庭码已经被使用');
  }

  await query(
    `INSERT INTO families (family_code, family_secret_hash, family_name, avatar_url, created_by_device_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      familyCode,
      options.familySecret ? deviceService.hashSecret(options.familySecret) : null,
      familyName,
      options.avatarUrl || null,
      options.deviceId || null
    ]
  );

  return getFamilyByCode(familyCode);
}

async function createFamilyForDevice(deviceId, familyName = null, options = {}) {
  const familyCode = createFamilyCode();
  const familySecret = deviceService.createDeviceSecret();
  const family = await createFamily(familyCode, familyName, {
    deviceId,
    familySecret,
    avatarUrl: options.avatarUrl
  });
  grantDeviceAccessToFamily(deviceId, family.familyCode);

  return {
    family,
    familySecret
  };
}

async function ensureFamilyExists(familyCode, familyName = null) {
  const current = await getFamilyByCode(familyCode);

  if (current) {
    return current;
  }

  return createFamily(familyCode, familyName);
}

async function getFamilyByCode(familyCode) {
  if (env.useMockDb) {
    const family = mockFamilies.get(familyCode);
    return family && !family.is_deleted ? toFamily(family) : null;
  }

  const rows = await query(
    `SELECT id, family_code, family_name, avatar_url, is_deleted, created_by_device_id, created_at, updated_at
     FROM families
     WHERE family_code = ? AND is_deleted = 0`,
    [familyCode]
  );

  return toFamily(rows[0]);
}

async function updateFamily(familyCode, familyName, avatarUrl = undefined) {
  if (env.useMockDb) {
    const current = mockFamilies.get(familyCode);

    if (!current || current.is_deleted) {
      return null;
    }

    if (familyName !== undefined) {
      current.family_name = familyName;
    }
    if (avatarUrl !== undefined) {
      current.avatar_url = avatarUrl || null;
    }
    current.updated_at = new Date().toISOString();
    mockFamilies.set(familyCode, current);
    return toFamily(current);
  }

  const updates = [];
  const params = [];

  if (familyName !== undefined) {
    updates.push('family_name = ?');
    params.push(familyName);
  }

  if (avatarUrl !== undefined) {
    updates.push('avatar_url = ?');
    params.push(avatarUrl || null);
  }

  if (updates.length) {
    await query(
      `UPDATE families
       SET ${updates.join(', ')}
       WHERE family_code = ? AND is_deleted = 0`,
      [...params, familyCode]
    );
  }

  return getFamilyByCode(familyCode);
}

async function deleteFamily(familyCode) {
  if (env.useMockDb) {
    const current = mockFamilies.get(familyCode);

    if (!current || current.is_deleted) {
      return null;
    }

    current.is_deleted = 1;
    current.updated_at = new Date().toISOString();
    mockFamilies.set(familyCode, current);
    return toFamily(current);
  }

  await query(
    `UPDATE families
     SET is_deleted = 1
     WHERE family_code = ? AND is_deleted = 0`,
    [familyCode]
  );

  const rows = await query(
    `SELECT id, family_code, family_name, avatar_url, is_deleted, created_by_device_id, created_at, updated_at
     FROM families
     WHERE family_code = ?`,
    [familyCode]
  );

  return toFamily(rows[0]);
}

async function createFamilyInvite(familyCode, ttlMinutes = 60) {
  const family = await getFamilyByCode(familyCode);

  if (!family) {
    throw createNotFoundError('家庭不存在');
  }

  const inviteCode = createInviteCode();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  if (env.useMockDb) {
    mockInvites.set(inviteCode, {
      id: mockInvites.size + 1,
      family_code: familyCode,
      invite_code: inviteCode,
      expires_at: expiresAt.toISOString(),
      used_at: null,
      created_at: new Date().toISOString()
    });

    return {
      familyCode,
      inviteCode,
      expiresAt: expiresAt.toISOString()
    };
  }

  await query(
    `INSERT INTO family_invites (family_code, invite_code, expires_at)
     VALUES (?, ?, ?)`,
    [familyCode, inviteCode, expiresAt]
  );

  return {
    familyCode,
    inviteCode,
    expiresAt
  };
}

async function consumeFamilyInvite(inviteCode) {
  if (env.useMockDb) {
    const invite = mockInvites.get(inviteCode);

    if (!invite || Date.parse(invite.expires_at) <= Date.now()) {
      throw createNotFoundError('邀请码无效或已过期');
    }

    invite.used_at = new Date().toISOString();
    mockInvites.set(inviteCode, invite);
    return invite.family_code;
  }

  const rows = await query(
    `SELECT id, family_code, expires_at, used_at
     FROM family_invites
     WHERE invite_code = ?`,
    [inviteCode]
  );
  const invite = rows[0];

  if (!invite || new Date(invite.expires_at).getTime() <= Date.now()) {
    throw createNotFoundError('邀请码无效或已过期');
  }

  await query(
    `UPDATE family_invites SET used_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [invite.id]
  );

  return invite.family_code;
}

async function assertDeviceCanAccessFamily(deviceId, familyCode) {
  if (env.useMockDb) {
    if (mockFamilyAccess.has(getAccessKey(deviceId, familyCode))) {
      return true;
    }

    throw createForbiddenError();
  }

  const rows = await query(
    `SELECT id
     FROM family_members
     WHERE family_code = ? AND device_id = ? AND revoked_at IS NULL
     LIMIT 1`,
    [familyCode, deviceId]
  );

  if (rows[0]) {
    return true;
  }

  throw createForbiddenError();
}

function grantDeviceAccessToFamily(deviceId, familyCode) {
  if (env.useMockDb && deviceId && familyCode) {
    mockFamilyAccess.add(getAccessKey(deviceId, familyCode));
  }
}

function revokeDeviceAccessFromFamily(deviceId, familyCode) {
  if (env.useMockDb && deviceId && familyCode) {
    mockFamilyAccess.delete(getAccessKey(deviceId, familyCode));
  }
}

module.exports = {
  createFamily,
  createFamilyForDevice,
  ensureFamilyExists,
  getFamilyByCode,
  updateFamily,
  deleteFamily,
  createFamilyInvite,
  consumeFamilyInvite,
  assertDeviceCanAccessFamily,
  grantDeviceAccessToFamily,
  revokeDeviceAccessFromFamily
};
