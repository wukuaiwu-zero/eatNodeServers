const { query } = require('../config/db');
const { env } = require('../config/env');

const mockFamilies = new Map();

// families 表只保存“家庭本身”的信息，比如家庭码、家庭名、是否删除。
// 成员属于哪个家庭、购物清单有哪些、食材库有哪些，都放在各自的表里。
// 这样家庭作为一个稳定的上层容器，下面的业务可以独立演进。

function createConflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function toFamily(row) {
  // 数据库字段命名偏 SQL，接口返回偏 JS。
  // 这里集中做字段转换，controller/service 其他地方就不用反复写映射逻辑。
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
  // 创建家庭时不允许重复 familyCode。
  // familyCode 相当于家庭邀请码/唯一标识，后续成员加入和共享数据都靠它关联。
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
  // 这是“懒创建”入口：首次上传家庭菜谱/购物数据时，如果家庭不存在就自动创建。
  // 对前端来说更顺滑，不需要先单独调用创建家庭接口。
  const current = await getFamilyByCode(familyCode);

  if (current) {
    return current;
  }

  return createFamily(familyCode, familyName);
}

async function getFamilyByCode(familyCode) {
  // 软删除后的家庭不会被普通查询返回。
  // 如果以后要做恢复家庭，再单独增加包含 is_deleted 的管理接口。
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
  // 家庭删除也采用软删除，只标记 is_deleted=1。
  // 这样历史成员关系和业务数据还在，后续做恢复/审计会更稳。
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
