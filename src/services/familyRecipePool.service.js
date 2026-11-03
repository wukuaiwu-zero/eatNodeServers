const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');
const publicRecipeCatalog = require('./publicRecipeCatalog.service');

const TABLE_NAME = 'family_recipe_pool_items';
const DISH_TYPE_TAKEOUT = '外卖';
const DISH_TYPE_DINE_IN = '堂食';
const DISH_TYPE_COOK = '做饭';
const DISH_TYPES = new Set([DISH_TYPE_TAKEOUT, DISH_TYPE_DINE_IN, DISH_TYPE_COOK]);
const MANUAL_WEIGHT_MIN = 0.2;
const MANUAL_WEIGHT_MAX = 3;
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

const SELECT_COLUMNS = `id, dish_id, family_code, name, recipe_id, type, manual_weight, paused,
  is_default, version, deleted_at, created_at, updated_at`;

const mockItems = new Map();
let poolWeightColumnsReadyPromise = null;

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

function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
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

function normalizeManualWeight(value, fallback = 1) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const weight = Number(value);
  if (!Number.isFinite(weight)) {
    throw new TypeError('手动权重必须是数字');
  }

  if (weight < MANUAL_WEIGHT_MIN || weight > MANUAL_WEIGHT_MAX) {
    throw new TypeError(`手动权重必须在 ${MANUAL_WEIGHT_MIN} ~ ${MANUAL_WEIGHT_MAX} 之间`);
  }

  return Math.round(weight * 100) / 100;
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

  const hasManualWeight = Object.prototype.hasOwnProperty.call(dish, 'manualWeight')
    || Object.prototype.hasOwnProperty.call(dish, 'manual_weight')
    || Object.prototype.hasOwnProperty.call(dish, 'weight');
  const hasPaused = Object.prototype.hasOwnProperty.call(dish, 'paused')
    || Object.prototype.hasOwnProperty.call(dish, 'isPaused')
    || Object.prototype.hasOwnProperty.call(dish, 'is_paused');
  const hasRecipeId = Object.prototype.hasOwnProperty.call(dish, 'recipeId')
    || Object.prototype.hasOwnProperty.call(dish, 'recipe_id');

  return {
    dishId: normalizeText(dish.id || dish._id || dish.dishId) || createDishId(name),
    name,
    type: normalizeDishType(dish.type),
    recipeId: hasRecipeId
      ? (normalizeText(dish.recipeId || dish.recipe_id) || null)
      : undefined,
    manualWeight: hasManualWeight
      ? normalizeManualWeight(dish.manualWeight ?? dish.manual_weight ?? dish.weight)
      : undefined,
    paused: hasPaused
      ? normalizeBoolean(dish.paused ?? dish.isPaused ?? dish.is_paused, false)
      : undefined
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
    recipeId: row.recipe_id || null,
    type: row.type,
    manualWeight: row.manual_weight === null || row.manual_weight === undefined
      ? 1
      : Number(row.manual_weight),
    paused: Boolean(row.paused),
    isDefault: Boolean(row.is_default),
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function ensurePoolWeightColumns() {
  if (env.useMockDb) {
    return;
  }

  if (!poolWeightColumnsReadyPromise) {
    poolWeightColumnsReadyPromise = (async () => {
      const columns = [
        { name: 'recipe_id', ddl: "ADD COLUMN recipe_id VARCHAR(64) DEFAULT NULL COMMENT '关联家庭菜谱ID' AFTER name" },
        { name: 'manual_weight', ddl: "ADD COLUMN manual_weight DECIMAL(6,2) NOT NULL DEFAULT 1.00 COMMENT '手动权重' AFTER type" },
        { name: 'paused', ddl: "ADD COLUMN paused TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否暂停参与抽签' AFTER manual_weight" }
      ];

      for (const column of columns) {
        const rows = await query(
          `SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = ?
             AND COLUMN_NAME = ?
           LIMIT 1`,
          [TABLE_NAME, column.name]
        );

        if (!rows.length) {
          try {
            await query(`ALTER TABLE ${TABLE_NAME} ${column.ddl}`);
          } catch (error) {
            if (error.code !== 'ER_DUP_FIELDNAME') {
              throw error;
            }
          }
        }
      }
    })().catch((error) => {
      poolWeightColumnsReadyPromise = null;
      throw error;
    });
  }

  await poolWeightColumnsReadyPromise;
}

async function resolveRecipeIdByName(familyCode, dishName, preferredRecipeId = null) {
  const preferred = normalizeText(preferredRecipeId);
  if (preferred) {
    return preferred;
  }

  const familyRecipe = await familyRecipeService.getFamilyRecipeByCode(familyCode);
  const recipes = familyRecipe?.recipes || [];
  const matched = recipes.find((recipe) => normalizeText(recipe.name) === normalizeText(dishName));
  return matched ? (matched.recipeId || matched.id) : null;
}

async function ensureDefaultDishes(familyCode) {
  await ensurePoolWeightColumns();

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
          recipe_id: null,
          type: DISH_TYPE_COOK,
          manual_weight: 1,
          paused: 0,
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
         (dish_id, family_code, name, type, manual_weight, paused, is_default, created_by, updated_by, version)
       VALUES (?, ?, ?, ?, 1, 0, 1, 'system', 'system', 1)
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
  const publicRecipe = publicRecipeCatalog.findByName(name);
  if (publicRecipe && publicRecipe.id !== dishId) {
    throw createConflictError('菜品名称已存在');
  }

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
  await ensurePoolWeightColumns();
  const normalized = normalizeDish(dishJson);
  const effectiveType = await getEffectiveDishType(familyCode, normalized.dishId, normalized.type);
  await assertUniqueName(familyCode, normalized.dishId, normalized.name, effectiveType);

  const current = await getDishByFamily(familyCode, normalized.dishId);
  const manualWeight = normalized.manualWeight !== undefined
    ? normalized.manualWeight
    : (current?.manualWeight ?? 1);
  const paused = normalized.paused !== undefined
    ? normalized.paused
    : Boolean(current?.paused);

  let preferredRecipeId = null;
  if (normalized.recipeId !== undefined) {
    preferredRecipeId = normalized.recipeId;
  } else if (current && current.name === normalized.name && current.recipeId) {
    preferredRecipeId = current.recipeId;
  }

  const recipeId = await resolveRecipeIdByName(familyCode, normalized.name, preferredRecipeId);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const key = getMockKey(familyCode, normalized.dishId);
    const mockCurrent = mockItems.get(key);
    const row = {
      id: mockCurrent?.id || mockItems.size + 1,
      dish_id: normalized.dishId,
      family_code: familyCode,
      name: normalized.name,
      recipe_id: recipeId,
      type: effectiveType,
      manual_weight: manualWeight,
      paused: paused ? 1 : 0,
      is_default: mockCurrent?.is_default || 0,
      created_by: mockCurrent?.created_by || memberCode,
      updated_by: memberCode,
      version: (mockCurrent?.version || 0) + 1,
      deleted_at: null,
      created_at: mockCurrent?.created_at || now,
      updated_at: now
    };

    mockItems.set(key, row);
    return toDish(row);
  }

  await query(
    `INSERT INTO ${TABLE_NAME}
       (dish_id, family_code, name, recipe_id, type, manual_weight, paused, is_default, created_by, updated_by, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       recipe_id = VALUES(recipe_id),
       type = IF(? = 1, VALUES(type), type),
       manual_weight = VALUES(manual_weight),
       paused = VALUES(paused),
       updated_by = VALUES(updated_by),
       version = version + 1,
       deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      normalized.dishId,
      familyCode,
      normalized.name,
      recipeId,
      effectiveType,
      manualWeight,
      paused ? 1 : 0,
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

async function listDishRecords(familyCode) {
  await ensurePoolWeightColumns();

  if (env.useMockDb) {
    return Array.from(mockItems.values())
      .filter((row) => row.family_code === familyCode)
      .sort((a, b) => a.id - b.id)
      .map(toDish);
  }

  const rows = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM ${TABLE_NAME}
     WHERE family_code = ?
     ORDER BY id ASC`,
    [familyCode]
  );

  return rows.map(toDish);
}

async function listHiddenPublicDishIds(familyCode) {
  const publicIds = new Set(publicRecipeCatalog.listRecipes().map((recipe) => recipe.id));
  const records = await listDishRecords(familyCode);
  return records
    .filter((dish) => dish.deleted && publicIds.has(dish.dishId))
    .map((dish) => dish.dishId);
}

async function getDishByFamily(familyCode, dishId) {
  await ensurePoolWeightColumns();

  if (env.useMockDb) {
    return toDish(mockItems.get(getMockKey(familyCode, dishId)));
  }

  const rows = await query(
    `SELECT ${SELECT_COLUMNS}
     FROM ${TABLE_NAME}
     WHERE family_code = ? AND dish_id = ?`,
    [familyCode, dishId]
  );

  return toDish(rows[0]);
}

async function listDishesByFamily(familyCode, options = {}) {
  const records = await listDishRecords(familyCode);
  const recipe = await familyRecipeService.getFamilyRecipeByCode(familyCode);
  const ownNames = (recipe?.recipes || [])
    .filter((item) => item.source !== 'public')
    .map((item) => normalizeText(item.name))
    .filter(Boolean);

  return publicRecipeCatalog.mergePoolDishes(records, {
    includeDeleted: Boolean(options.includeDeleted),
    familyCode,
    ownNames
  });
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
    dishes,
    publicCatalogVersion: publicRecipeCatalog.getVersion()
  };
}

async function insertHiddenPublicDish(familyCode, memberCode, recipe) {
  if (env.useMockDb) {
    const now = new Date().toISOString();
    const row = {
      id: mockItems.size + 1,
      dish_id: recipe.id,
      family_code: familyCode,
      name: recipe.name,
      recipe_id: recipe.id,
      type: recipe.type,
      manual_weight: 1,
      paused: 0,
      is_default: 1,
      created_by: memberCode,
      updated_by: memberCode,
      version: 1,
      deleted_at: now,
      created_at: now,
      updated_at: now
    };
    mockItems.set(getMockKey(familyCode, recipe.id), row);
    return publicRecipeCatalog.mergePoolDishes([toDish(row)], {
      includeDeleted: true,
      familyCode
    }).find((dish) => dish.dishId === recipe.id) || null;
  }

  await query(
    `INSERT INTO ${TABLE_NAME}
       (dish_id, family_code, name, recipe_id, type, manual_weight, paused, is_default, created_by, updated_by, version, deleted_at)
     VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?, ?, 1, CURRENT_TIMESTAMP)`,
    [recipe.id, familyCode, recipe.name, recipe.id, recipe.type, memberCode, memberCode]
  );

  const hidden = await getDishByFamily(familyCode, recipe.id);
  return publicRecipeCatalog.mergePoolDishes(hidden ? [hidden] : [], {
    includeDeleted: true,
    familyCode
  }).find((dish) => dish.dishId === recipe.id) || null;
}

async function hidePublicDish(familyCode, memberCode, dishId) {
  const recipe = publicRecipeCatalog.getRecipe(dishId);
  if (!recipe) {
    return null;
  }

  const current = await getDishByFamily(familyCode, dishId);
  if (current?.deleted) {
    return null;
  }

  if (current) {
    return deleteDishByFamily(familyCode, dishId, memberCode);
  }

  return insertHiddenPublicDish(familyCode, memberCode, recipe);
}

async function deleteDishByFamily(familyCode, dishId, memberCode) {
  await ensurePoolWeightColumns();
  const dish = await getDishByFamily(familyCode, dishId);

  if (!dish) {
    return hidePublicDish(familyCode, memberCode, dishId);
  }

  if (dish.deleted) {
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
  listHiddenPublicDishIds,
  hidePublicDish,
  deleteDishByDevice
};
