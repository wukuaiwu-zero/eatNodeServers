const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

const TABLE_NAME = 'family_recipe_pool_items';
const DISH_TYPE_TAKEOUT = '外卖';
const DISH_TYPE_DINE_IN = '堂食';
const DISH_TYPE_COOK = '做饭';
const DISH_TYPES = new Set([DISH_TYPE_TAKEOUT, DISH_TYPE_DINE_IN, DISH_TYPE_COOK]);
const DEFAULT_DISHES = [
  '番茄炒蛋',
  '可乐鸡翅',
  '青椒肉丝',
  '蒜蓉西兰花',
  '红烧肉',
  '酸辣土豆丝',
  '水煮肉片',
  '香菇滑鸡',
  '蛋炒饭',
  '粉蒸排骨',
  '糖醋里脊',
  '麻婆豆腐',
  '手撕包菜',
  '清炒菜心'
];

const mockItems = new Map();

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

function createDishId(name, index = null) {
  if (index !== null) {
    return `default_dish_${index + 1}`;
  }

  return `dish_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getMockKey(familyCode, dishId) {
  return `${familyCode}:${dishId}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDishType(value) {
  const type = normalizeText(value);

  if (!type) {
    return '';
  }

  if (!DISH_TYPES.has(type)) {
    throw new TypeError('菜品类型只能是外卖、堂食、做饭');
  }

  return type;
}

function getStoredDishType(value) {
  const type = normalizeText(value);
  return DISH_TYPES.has(type) ? type : DISH_TYPE_COOK;
}

function normalizeDish(dishJson) {
  if (dishJson === undefined || dishJson === null) {
    throw new TypeError('请填写菜品数据');
  }

  const dish = typeof dishJson === 'string' ? JSON.parse(dishJson) : { ...dishJson };

  if (!dish || typeof dish !== 'object' || Array.isArray(dish)) {
    throw new TypeError('菜品数据格式不正确');
  }

  const name = normalizeText(dish.name || dish.dishName);

  if (!name) {
    throw new TypeError('菜品名称不能为空');
  }

  return {
    dishId: normalizeText(dish.id || dish._id || dish.dishId) || createDishId(name),
    name,
    type: normalizeDishType(dish.type)
  };
}

function toDish(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.dish_id,
    _id: row.dish_id,
    dishId: row.dish_id,
    familyCode: row.family_code,
    name: row.name,
    type: row.type,
    isDefault: Boolean(row.is_default),
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function ensureDefaultDishes(familyCode) {
  if (env.useMockDb) {
    const now = new Date().toISOString();

    DEFAULT_DISHES.forEach((name, index) => {
      const dishId = createDishId(name, index);
      const key = getMockKey(familyCode, dishId);

      if (!mockItems.has(key)) {
        mockItems.set(key, {
          id: mockItems.size + 1,
          dish_id: dishId,
          family_code: familyCode,
          name,
          type: DISH_TYPE_COOK,
          is_default: 1,
          created_by: 'system',
          updated_by: 'system',
          version: 1,
          deleted_at: null,
          created_at: now,
          updated_at: now
        });
      }
    });
    return;
  }

  for (const [index, name] of DEFAULT_DISHES.entries()) {
    await query(
      `INSERT INTO ${TABLE_NAME}
         (dish_id, family_code, name, type, is_default, created_by, updated_by, version)
       VALUES (?, ?, ?, ?, 1, 'system', 'system', 1)
       ON DUPLICATE KEY UPDATE
         updated_at = updated_at`,
      [createDishId(name, index), familyCode, name, DISH_TYPE_COOK]
    );
  }
}

async function getEffectiveDishType(familyCode, dishId, inputType) {
  if (inputType) {
    return inputType;
  }

  const current = await getDishByFamily(familyCode, dishId);
  return getStoredDishType(current?.type);
}

async function assertUniqueName(familyCode, dishId, name, type) {
  if (env.useMockDb) {
    const duplicated = Array.from(mockItems.values()).find((row) => {
      return row.family_code === familyCode
        && !row.deleted_at
        && row.dish_id !== dishId
        && row.name === name
        && getStoredDishType(row.type) === type;
    });

    if (duplicated) {
      throw createConflictError('菜品名称已存在');
    }

    return;
  }

  const rows = await query(
    `SELECT dish_id
     FROM ${TABLE_NAME}
     WHERE family_code = ? AND name = ? AND type = ? AND deleted_at IS NULL AND dish_id <> ?
     LIMIT 1`,
    [familyCode, name, type, dishId]
  );

  if (rows[0]) {
    throw createConflictError('菜品名称已存在');
  }
}

async function upsertDish(familyCode, memberCode, dishJson) {
  await ensureDefaultDishes(familyCode);
  const normalized = normalizeDish(dishJson);
  const effectiveType = await getEffectiveDishType(familyCode, normalized.dishId, normalized.type);
  await assertUniqueName(familyCode, normalized.dishId, normalized.name, effectiveType);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const key = getMockKey(familyCode, normalized.dishId);
    const current = mockItems.get(key);
    const row = {
      id: current?.id || mockItems.size + 1,
      dish_id: normalized.dishId,
      family_code: familyCode,
      name: normalized.name,
      type: effectiveType,
      is_default: current?.is_default || 0,
      created_by: current?.created_by || memberCode,
      updated_by: memberCode,
      version: (current?.version || 0) + 1,
      deleted_at: null,
      created_at: current?.created_at || now,
      updated_at: now
    };

    mockItems.set(key, row);
    return toDish(row);
  }

  await query(
    `INSERT INTO ${TABLE_NAME}
       (dish_id, family_code, name, type, is_default, created_by, updated_by, version)
     VALUES (?, ?, ?, ?, 0, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       type = IF(? = 1, VALUES(type), type),
       updated_by = VALUES(updated_by),
       version = version + 1,
       deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      normalized.dishId,
      familyCode,
      normalized.name,
      effectiveType,
      memberCode,
      memberCode,
      normalized.type ? 1 : 0
    ]
  );

  return getDishByFamily(familyCode, normalized.dishId);
}

async function upsertDishByDevice(deviceId, familyCode, dishJson) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const dish = await upsertDish(member.familyCode, member.memberCode, dishJson);

  return {
    member,
    dish
  };
}

async function getDishByFamily(familyCode, dishId) {
  if (env.useMockDb) {
    return toDish(mockItems.get(getMockKey(familyCode, dishId)));
  }

  const rows = await query(
    `SELECT id, dish_id, family_code, name, type, is_default, version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE family_code = ? AND dish_id = ?`,
    [familyCode, dishId]
  );

  return toDish(rows[0]);
}

async function listDishesByFamily(familyCode, options = {}) {
  await ensureDefaultDishes(familyCode);
  const includeDeleted = Boolean(options.includeDeleted);

  if (env.useMockDb) {
    return Array.from(mockItems.values())
      .filter((row) => row.family_code === familyCode)
      .filter((row) => includeDeleted || !row.deleted_at)
      .sort((a, b) => a.id - b.id)
      .map(toDish);
  }

  const deletedFilter = includeDeleted ? '' : 'AND deleted_at IS NULL';
  const rows = await query(
    `SELECT id, dish_id, family_code, name, type, is_default, version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE family_code = ? ${deletedFilter}
     ORDER BY id ASC`,
    [familyCode]
  );

  return rows.map(toDish);
}

async function getMemberByDevice(deviceId, options = {}) {
  const familyCode = normalizeText(options.familyCode || options.family_code);
  return familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);
}

async function listDishesByDevice(deviceId, options = {}) {
  const member = await getMemberByDevice(deviceId, options);

  if (!member) {
    return null;
  }

  const dishes = await listDishesByFamily(member.familyCode);

  return {
    member,
    dishes
  };
}

async function deleteDishByFamily(familyCode, dishId, memberCode) {
  await ensureDefaultDishes(familyCode);
  const dish = await getDishByFamily(familyCode, dishId);

  if (!dish || dish.deleted) {
    return null;
  }

  if (env.useMockDb) {
    const key = getMockKey(familyCode, dishId);
    const current = mockItems.get(key);
    current.deleted_at = new Date().toISOString();
    current.updated_by = memberCode;
    current.version += 1;
    current.updated_at = current.deleted_at;
    mockItems.set(key, current);
    return toDish(current);
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_by = ?,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND dish_id = ? AND deleted_at IS NULL`,
    [memberCode, familyCode, dishId]
  );

  return getDishByFamily(familyCode, dishId);
}

async function deleteDishByDevice(deviceId, dishId, options = {}) {
  const member = await getMemberByDevice(deviceId, options);

  if (!member) {
    return null;
  }

  const dish = await deleteDishByFamily(member.familyCode, dishId, member.memberCode);

  if (!dish) {
    throw createNotFoundError('菜品不存在');
  }

  return {
    member,
    dish
  };
}

module.exports = {
  ensureDefaultDishes,
  upsertDishByDevice,
  listDishesByFamily,
  listDishesByDevice,
  deleteDishByDevice
};
