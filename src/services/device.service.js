const crypto = require('crypto');
const { query } = require('../config/db');
const { env } = require('../config/env');

const mockDevices = new Map();

function createAuthError(message = '设备身份校验失败，请重新注册设备或检查设备密钥') {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

function createDeviceId() {
  return `dev_${crypto.randomBytes(12).toString('hex')}`;
}

function createDeviceSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSecret(secret, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(secret, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifySecret(secret, storedHash) {
  const [salt, hash] = String(storedHash || '').split(':');

  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(secret, salt, 32);
  const stored = Buffer.from(hash, 'hex');

  return stored.length === candidate.length && crypto.timingSafeEqual(candidate, stored);
}

function toDevice(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    deviceId: row.device_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  };
}

async function registerDevice(input = {}) {
  const deviceId = input.deviceId || createDeviceId();
  const deviceSecret = input.deviceSecret || createDeviceSecret();
  const secretHash = hashSecret(deviceSecret);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const current = mockDevices.get(deviceId);

    if (!current) {
      mockDevices.set(deviceId, {
        id: mockDevices.size + 1,
        device_id: deviceId,
        device_secret_hash: secretHash,
        created_at: now,
        last_seen_at: now
      });
    }

    return {
      device: toDevice(mockDevices.get(deviceId)),
      deviceSecret: current ? undefined : deviceSecret
    };
  }

  const current = await getDeviceById(deviceId);

  if (current) {
    await query(
      `UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?`,
      [deviceId]
    );

    return {
      device: current,
      deviceSecret: undefined
    };
  }

  await query(
    `INSERT INTO devices (device_id, device_secret_hash, last_seen_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [deviceId, secretHash]
  );

  return {
    device: await getDeviceById(deviceId),
    deviceSecret
  };
}

async function getDeviceById(deviceId) {
  if (env.useMockDb) {
    return toDevice(mockDevices.get(deviceId));
  }

  const rows = await query(
    `SELECT id, device_id, created_at, last_seen_at
     FROM devices
     WHERE device_id = ?`,
    [deviceId]
  );

  return toDevice(rows[0]);
}

async function authenticateDevice(deviceId, deviceSecret) {
  if (!deviceId || !deviceSecret) {
    throw createAuthError('请先注册设备，再访问这个接口');
  }

  if (env.useMockDb) {
    const row = mockDevices.get(deviceId);

    if (!row || !verifySecret(deviceSecret, row.device_secret_hash)) {
      throw createAuthError();
    }

    row.last_seen_at = new Date().toISOString();
    mockDevices.set(deviceId, row);
    return toDevice(row);
  }

  const rows = await query(
    `SELECT id, device_id, device_secret_hash, created_at, last_seen_at
     FROM devices
     WHERE device_id = ?`,
    [deviceId]
  );
  const row = rows[0];

  if (!row || !verifySecret(deviceSecret, row.device_secret_hash)) {
    throw createAuthError();
  }

  await query(
    `UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE device_id = ?`,
    [deviceId]
  );

  return toDevice(row);
}

module.exports = {
  registerDevice,
  authenticateDevice,
  getDeviceById,
  createDeviceSecret,
  hashSecret
};
