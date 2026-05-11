const { query } = require('../config/db');
const { env } = require('../config/env');

const mockFamilies = new Map();

function createConflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function toFamily(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    familyCode: row.family_code,
    familyName: row.family_name,
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createFamily(familyCode, familyName = null) {
  if (env.useMockDb) {
    const current = mockFamilies.get(familyCode);

    if (current) {
      throw createConflictError('familyCode already exists');
    }

    const now = new Date().toISOString();
    const row = {
      id: current?.id || mockFamilies.size + 1,
      family_code: familyCode,
      family_name: familyName,
      is_deleted: 0,
      created_at: current?.created_at || now,
      updated_at: now
    };

    mockFamilies.set(familyCode, row);
    return toFamily(row);
  }

  const rows = await query(
    `SELECT id, family_code, family_name, is_deleted, created_at, updated_at
     FROM families
     WHERE family_code = ?`,
    [familyCode]
  );
  const current = rows[0];

  if (current) {
    throw createConflictError('familyCode already exists');
  }

  await query(
    `INSERT INTO families (family_code, family_name)
     VALUES (?, ?)`,
    [familyCode, familyName]
  );
  return getFamilyByCode(familyCode);
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
    `SELECT id, family_code, family_name, is_deleted, created_at, updated_at
     FROM families
     WHERE family_code = ? AND is_deleted = 0`,
    [familyCode]
  );

  return toFamily(rows[0]);
}

async function updateFamily(familyCode, familyName) {
  if (env.useMockDb) {
    const current = mockFamilies.get(familyCode);

    if (!current || current.is_deleted) {
      return null;
    }

    current.family_name = familyName;
    current.updated_at = new Date().toISOString();
    mockFamilies.set(familyCode, current);
    return toFamily(current);
  }

  await query(
    `UPDATE families
     SET family_name = ?
     WHERE family_code = ? AND is_deleted = 0`,
    [familyName, familyCode]
  );

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
    `SELECT id, family_code, family_name, is_deleted, created_at, updated_at
     FROM families
     WHERE family_code = ?`,
    [familyCode]
  );

  return toFamily(rows[0]);
}

module.exports = {
  createFamily,
  ensureFamilyExists,
  getFamilyByCode,
  updateFamily,
  deleteFamily
};
