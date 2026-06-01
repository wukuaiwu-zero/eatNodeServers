const { pool, query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createConflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function createCategoryId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

function normalizeFamilyCode(familyCode) {
  return typeof familyCode === 'string' ? familyCode.trim() : '';
}

function normalizeSortOrder(sortOrder) {
  const value = Number(sortOrder);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function normalizeCategoryIds(categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    throw new TypeError('请填写完整的类别 ID 排序列表');
  }

  const normalized = categoryIds.map((categoryId) => normalizeName(String(categoryId)));

  if (normalized.some((categoryId) => !categoryId)) {
    throw new TypeError('类别 ID 不能为空');
  }

  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError('类别 ID 不能重复');
  }

  return normalized;
}

function normalizeCategory(categoryJson, idPrefix) {
  if (categoryJson === undefined || categoryJson === null) {
    throw new TypeError('请填写类别数据');
  }

  const category = typeof categoryJson === 'string' ? JSON.parse(categoryJson) : { ...categoryJson };

  if (!category || typeof category !== 'object' || Array.isArray(category)) {
    throw new TypeError('类别数据格式不正确');
  }

  const name = normalizeName(category.name);

  if (!name) {
    throw new TypeError('类别名称不能为空');
  }

  return {
    categoryId: normalizeName(category.id || category._id || category.categoryId) || createCategoryId(idPrefix),
    name,
    sortOrder: normalizeSortOrder(category.sortOrder ?? category.sort_order)
  };
}

function toCategory(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.category_id,
    _id: row.category_id,
    categoryId: row.category_id,
    familyCode: row.family_code,
    name: row.name,
    sortOrder: row.sort_order,
    isDefault: Boolean(row.is_default),
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createFamilyCategoryService({ tableName, idPrefix, defaultCategories }) {
  const mockCategories = new Map();

  function getMockKey(familyCode, categoryId) {
    return `${familyCode}:${categoryId}`;
  }

  async function ensureDefaultCategories(familyCode) {
    if (env.useMockDb) {
      const now = new Date().toISOString();

      for (const category of defaultCategories) {
        const key = getMockKey(familyCode, category.id);

        if (!mockCategories.has(key)) {
          mockCategories.set(key, {
            id: mockCategories.size + 1,
            category_id: category.id,
            family_code: familyCode,
            name: category.name,
            sort_order: category.sortOrder,
            is_default: 1,
            created_by: 'system',
            updated_by: 'system',
            version: 1,
            deleted_at: null,
            created_at: now,
            updated_at: now
          });
        }
      }

      return;
    }

    for (const category of defaultCategories) {
      await query(
        `INSERT INTO ${tableName}
           (category_id, family_code, name, sort_order, is_default, created_by, updated_by, version)
         VALUES (?, ?, ?, ?, 1, 'system', 'system', 1)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           is_default = 1,
           updated_at = CURRENT_TIMESTAMP`,
        [category.id, familyCode, category.name, category.sortOrder]
      );
    }
  }

  async function assertUniqueName(familyCode, categoryId, name) {
    if (env.useMockDb) {
      const duplicated = Array.from(mockCategories.values()).find((row) => {
        return row.family_code === familyCode
          && !row.deleted_at
          && row.category_id !== categoryId
          && row.name === name;
      });

      if (duplicated) {
        throw createConflictError('类别名称已存在');
      }

      return;
    }

    const rows = await query(
      `SELECT category_id
       FROM ${tableName}
       WHERE family_code = ? AND name = ? AND deleted_at IS NULL AND category_id <> ?
       LIMIT 1`,
      [familyCode, name, categoryId]
    );

    if (rows[0]) {
      throw createConflictError('类别名称已存在');
    }
  }

  async function upsertCategory(familyCode, memberCode, categoryJson) {
    await ensureDefaultCategories(familyCode);
    const normalized = normalizeCategory(categoryJson, idPrefix);
    await assertUniqueName(familyCode, normalized.categoryId, normalized.name);

    if (env.useMockDb) {
      const now = new Date().toISOString();
      const key = getMockKey(familyCode, normalized.categoryId);
      const current = mockCategories.get(key);
      const row = {
        id: current?.id || mockCategories.size + 1,
        category_id: normalized.categoryId,
        family_code: familyCode,
        name: normalized.name,
        sort_order: normalized.sortOrder,
        is_default: current?.is_default || 0,
        created_by: current?.created_by || memberCode,
        updated_by: memberCode,
        version: (current?.version || 0) + 1,
        deleted_at: null,
        created_at: current?.created_at || now,
        updated_at: now
      };

      mockCategories.set(key, row);
      return toCategory(row);
    }

    await query(
      `INSERT INTO ${tableName}
         (category_id, family_code, name, sort_order, is_default, created_by, updated_by, version)
       VALUES (?, ?, ?, ?, 0, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         sort_order = VALUES(sort_order),
         updated_by = VALUES(updated_by),
         version = version + 1,
         deleted_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [
        normalized.categoryId,
        familyCode,
        normalized.name,
        normalized.sortOrder,
        memberCode,
        memberCode
      ]
    );

    return getCategoryByFamily(familyCode, normalized.categoryId);
  }

  async function assertCategoryNameAvailable(familyCode, categoryJson) {
    await ensureDefaultCategories(familyCode);
    const normalized = normalizeCategory(categoryJson, idPrefix);
    await assertUniqueName(familyCode, normalized.categoryId, normalized.name);
  }

  async function upsertCategoryByFamily(familyCode, memberCode, categoryJson) {
    return upsertCategory(familyCode, memberCode, categoryJson);
  }

  async function upsertCategoryByDevice(deviceId, familyCode, categoryJson) {
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

    if (!member) {
      return null;
    }

    const category = await upsertCategory(member.familyCode, member.memberCode, categoryJson);

    return {
      member,
      category
    };
  }

  async function getCategoryByFamily(familyCode, categoryId) {
    if (env.useMockDb) {
      return toCategory(mockCategories.get(getMockKey(familyCode, categoryId)));
    }

    const rows = await query(
      `SELECT id, category_id, family_code, name, sort_order, is_default, version, deleted_at, created_at, updated_at
       FROM ${tableName}
       WHERE family_code = ? AND category_id = ?`,
      [familyCode, categoryId]
    );

    return toCategory(rows[0]);
  }

  async function listCategoriesByFamily(familyCode, options = {}) {
    await ensureDefaultCategories(familyCode);
    const includeDeleted = Boolean(options.includeDeleted);

    if (env.useMockDb) {
      return Array.from(mockCategories.values())
        .filter((row) => row.family_code === familyCode)
        .filter((row) => includeDeleted || !row.deleted_at)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map(toCategory);
    }

    const deletedFilter = includeDeleted ? '' : 'AND deleted_at IS NULL';
    const rows = await query(
      `SELECT id, category_id, family_code, name, sort_order, is_default, version, deleted_at, created_at, updated_at
       FROM ${tableName}
       WHERE family_code = ? ${deletedFilter}
       ORDER BY sort_order ASC, id ASC`,
      [familyCode]
    );

    return rows.map(toCategory);
  }

  async function listCategoriesByDevice(deviceId, options = {}) {
    const familyCode = normalizeFamilyCode(options.familyCode || options.family_code);
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);

    if (!member) {
      return null;
    }

    const categories = await listCategoriesByFamily(member.familyCode);

    return {
      member,
      categories
    };
  }

  async function sortCategoriesByFamily(familyCode, memberCode, categoryIds) {
    await ensureDefaultCategories(familyCode);
    const normalizedIds = normalizeCategoryIds(categoryIds);

    if (env.useMockDb) {
      const activeCategories = Array.from(mockCategories.values())
        .filter((row) => row.family_code === familyCode && !row.deleted_at);
      const activeCategoryIds = new Set(activeCategories.map((row) => row.category_id));

      if (normalizedIds.length !== activeCategories.length
        || normalizedIds.some((categoryId) => !activeCategoryIds.has(categoryId))) {
        throw new TypeError('类别排序列表必须包含当前全部类别');
      }

      const now = new Date().toISOString();
      normalizedIds.forEach((categoryId, index) => {
        const key = getMockKey(familyCode, categoryId);
        const row = mockCategories.get(key);
        row.sort_order = (index + 1) * 10;
        row.updated_by = memberCode;
        row.version += 1;
        row.updated_at = now;
        mockCategories.set(key, row);
      });

      return listCategoriesByFamily(familyCode);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT category_id
         FROM ${tableName}
         WHERE family_code = ? AND deleted_at IS NULL
         FOR UPDATE`,
        [familyCode]
      );
      const activeCategoryIds = new Set(rows.map((row) => row.category_id));

      if (normalizedIds.length !== rows.length
        || normalizedIds.some((categoryId) => !activeCategoryIds.has(categoryId))) {
        throw new TypeError('类别排序列表必须包含当前全部类别');
      }

      for (const [index, categoryId] of normalizedIds.entries()) {
        await connection.execute(
          `UPDATE ${tableName}
           SET sort_order = ?,
               updated_by = ?,
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE family_code = ? AND category_id = ? AND deleted_at IS NULL`,
          [(index + 1) * 10, memberCode, familyCode, categoryId]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return listCategoriesByFamily(familyCode);
  }

  async function sortCategoriesByDevice(deviceId, familyCode, categoryIds) {
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

    if (!member) {
      return null;
    }

    const categories = await sortCategoriesByFamily(member.familyCode, member.memberCode, categoryIds);

    return {
      member,
      categories
    };
  }

  async function deleteCategoryByFamily(familyCode, categoryId, memberCode) {
    await ensureDefaultCategories(familyCode);
    const category = await getCategoryByFamily(familyCode, categoryId);

    if (!category || category.deleted) {
      return null;
    }

    if (env.useMockDb) {
      const key = getMockKey(familyCode, categoryId);
      const current = mockCategories.get(key);
      current.deleted_at = new Date().toISOString();
      current.updated_by = memberCode;
      current.version += 1;
      current.updated_at = current.deleted_at;
      mockCategories.set(key, current);
      return toCategory(current);
    }

    await query(
      `UPDATE ${tableName}
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_by = ?,
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE family_code = ? AND category_id = ? AND deleted_at IS NULL`,
      [memberCode, familyCode, categoryId]
    );

    return getCategoryByFamily(familyCode, categoryId);
  }

  async function deleteCategoryByDevice(deviceId, categoryId, options = {}) {
    const familyCode = normalizeFamilyCode(options.familyCode || options.family_code);
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);

    if (!member) {
      return null;
    }

    const category = await deleteCategoryByFamily(member.familyCode, categoryId, member.memberCode);

    if (!category) {
      throw createNotFoundError('类别不存在');
    }

    return {
      member,
      category
    };
  }

  return {
    ensureDefaultCategories,
    assertCategoryNameAvailable,
    upsertCategoryByFamily,
    upsertCategoryByDevice,
    getCategoryByFamily,
    listCategoriesByFamily,
    listCategoriesByDevice,
    sortCategoriesByDevice,
    deleteCategoryByDevice
  };
}

module.exports = {
  createFamilyCategoryService
};
