const { query } = require('../config/db');
const { env } = require('../config/env');
const familyService = require('./family.service');

const mockFamilyRecipes = new Map();
const mockFamilyRecipeIngredients = new Map();
const mockFamilyMembers = new Map();

const RELATION_TYPE_HOME = 'home';
const RELATION_TYPE_JOINED = 'joined';

function getMemberKey(familyCode, memberCode) {
  return `${familyCode}:${memberCode}`;
}

function getRecipeKey(familyCode, recipeId) {
  return `${familyCode}:${recipeId}`;
}

// 这个 service 历史上叫 familyRecipe，但现在也承载了“家庭成员绑定”的能力。
// 购物清单和食材库复用了这里的成员关系：
// memberCode -> familyCode 是所有家庭共享数据的入口。

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

function parseRecipeJsonSafely(recipeJson) {
  try {
    return typeof recipeJson === 'string' ? JSON.parse(recipeJson) : recipeJson;
  } catch (error) {
    return null;
  }
}

function normalizeCoverUrl(coverUrl) {
  return typeof coverUrl === 'string' ? coverUrl.trim() : '';
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

function stringifyJsonArray(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return '[]';
  }

  const parsed = typeof value === 'string' ? JSON.parse(value) : value;

  if (!Array.isArray(parsed)) {
    throw new TypeError(`${fieldName}格式不正确`);
  }

  return JSON.stringify(parsed);
}

function parseJsonArray(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function createRecipeId() {
  return `recipe_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIngredient(input, index) {
  const ingredient = input && typeof input === 'object' ? input : {};
  const name = normalizeText(ingredient.name);

  if (!name) {
    return null;
  }

  return {
    name,
    amount: normalizeText(ingredient.amount),
    isSeasoning: normalizeBoolean(ingredient.isSeasoning, false),
    sortOrder: Number.isInteger(ingredient.sortOrder) ? ingredient.sortOrder : index
  };
}

function normalizeRecipeItem(recipeItem, currentRecipe = null) {
  if (recipeItem === undefined || recipeItem === null) {
    throw new TypeError('请填写菜谱数据');
  }

  const parsed = typeof recipeItem === 'string' ? JSON.parse(recipeItem) : recipeItem;
  if (Array.isArray(parsed)) {
    throw new TypeError('单条菜谱接口只能提交一个菜谱对象');
  }

  const rawRecipe = parsed;
  const recipe = rawRecipe && typeof rawRecipe === 'object'
    ? { ...(currentRecipe || {}), ...rawRecipe }
    : rawRecipe;

  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
    throw new TypeError('菜谱数据格式不正确');
  }

  const name = typeof recipe.name === 'string' ? recipe.name.trim() : '';

  if (!name) {
    throw new TypeError('菜谱名称不能为空');
  }

  return {
    id: normalizeText(recipe.id || recipe._id || recipe.recipeId) || createRecipeId(),
    name,
    category: normalizeText(recipe.category),
    coverUrl: normalizeCoverUrl(recipe.coverUrl || recipe.cover),
    difficulty: normalizeText(recipe.difficulty),
    duration: normalizeText(recipe.duration),
    favorite: normalizeBoolean(recipe.favorite, false),
    own: normalizeBoolean(recipe.own, true),
    stepsJson: stringifyJsonArray(recipe.steps, '步骤'),
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map(normalizeIngredient).filter(Boolean)
      : []
  };
}

function normalizeRecipeCollectionInput(recipeJson) {
  const parsed = parseRecipeJsonSafely(recipeJson);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.recipes)) {
    return parsed.recipes;
  }

  return parsed ? [parsed] : [];
}

function getCoverUrlFromRecipeJson(recipeJson) {
  const parsed = parseRecipeJsonSafely(recipeJson);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? normalizeCoverUrl(parsed.coverUrl)
    : '';
}

function toRecipeItem(row, ingredients = []) {
  // 数据库字段是 snake_case，接口返回统一转成 camelCase。
  if (!row) {
    return null;
  }

  return {
    id: row.recipe_id,
    recipeId: row.recipe_id,
    familyCode: row.family_code,
    name: row.name,
    category: row.category || '',
    cover: row.cover_url || '',
    coverUrl: row.cover_url || '',
    difficulty: row.difficulty || '',
    duration: row.duration || '',
    favorite: Boolean(row.favorite),
    own: Boolean(row.own),
    ingredients,
    steps: parseJsonArray(row.steps_json),
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toFamilyRecipe(familyCode, recipes = []) {
  return {
    familyCode,
    coverUrl: recipes.find((recipe) => recipe.coverUrl)?.coverUrl || '',
    recipeJson: {
      recipes
    },
    recipes
  };
}

function toFamilyMember(row) {
  // family_members 是“某个设备/用户标识属于哪个家庭”的关系表。
  // 当前没有完整登录体系，所以 memberCode 相当于前端侧保存的成员身份。
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    memberCode: row.member_code,
    familyCode: row.family_code,
    deviceId: row.device_id || null,
    name: row.member_name || null,
    title: row.title || null,
    avatarUrl: row.avatar_url || null,
    role: row.role || 'member',
    relationType: row.relation_type || RELATION_TYPE_JOINED,
    isHomeFamily: (row.relation_type || RELATION_TYPE_JOINED) === RELATION_TYPE_HOME,
    isManager: ['owner', 'admin', 'manager'].includes(row.role || 'member'),
    joinedFamily: Boolean(row.joined_family),
    revokedAt: row.revoked_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function findMockMemberByDevice(deviceId, familyCode = null) {
  return Array.from(mockFamilyMembers.values())
    .filter((member) => {
      if (member.device_id !== deviceId || member.revoked_at) {
        return false;
      }

      return familyCode ? member.family_code === familyCode : true;
    })
    .sort((a, b) => {
      if (a.relation_type === b.relation_type) {
        return a.id - b.id;
      }

      return a.relation_type === RELATION_TYPE_HOME ? -1 : 1;
    })[0];
}

async function bindMemberToInitialFamily(memberCode, familyCode, options = {}) {
  // 首次上传家庭数据时，允许自动创建家庭并把 memberCode 绑定进去。
  // 这是为了降低客户端接入成本：前端只要带 memberCode + familyCode + 数据，就能完成初始化。
  await familyService.ensureFamilyExists(familyCode);

  if (env.useMockDb) {
    const key = getMemberKey(familyCode, memberCode);
    const current = mockFamilyMembers.get(key);
    const now = new Date().toISOString();
    const row = current || {
      id: mockFamilyMembers.size + 1,
      member_code: memberCode,
      family_code: familyCode,
      device_id: options.deviceId || null,
      role: options.role || 'member',
      relation_type: options.relationType || RELATION_TYPE_JOINED,
      joined_family: 0,
      revoked_at: null,
      created_at: now,
      updated_at: now
    };

    row.device_id = row.device_id || options.deviceId || null;
    row.role = options.role || row.role || 'member';
    row.relation_type = options.relationType || row.relation_type || RELATION_TYPE_JOINED;
    row.revoked_at = null;
    row.updated_at = now;
    mockFamilyMembers.set(key, row);
    return toFamilyMember(row);
  }

  await query(
    `INSERT INTO family_members (member_code, family_code, device_id, role, relation_type)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       device_id = IF(device_id IS NULL, VALUES(device_id), device_id),
       role = VALUES(role),
       relation_type = IF(relation_type = 'home', relation_type, VALUES(relation_type)),
       joined_family = 1,
       revoked_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      memberCode,
      familyCode,
      options.deviceId || null,
      options.role || 'member',
      options.relationType || RELATION_TYPE_JOINED
    ]
  );

  return getFamilyMemberByCode(memberCode, familyCode);
}

async function bindDeviceToFamily(deviceId, familyCode, role = 'member', options = {}) {
  await familyService.ensureFamilyExists(familyCode);
  const relationType = options.relationType || RELATION_TYPE_JOINED;

  if (env.useMockDb) {
    const key = getMemberKey(familyCode, deviceId);
    const row = mockFamilyMembers.get(key);

    if (!row) {
      const now = new Date().toISOString();
      const member = {
        id: mockFamilyMembers.size + 1,
        member_code: deviceId,
        family_code: familyCode,
        device_id: deviceId,
        role,
        relation_type: relationType,
        joined_family: 1,
        revoked_at: null,
        created_at: now,
        updated_at: now
      };
      mockFamilyMembers.set(key, member);
      familyService.grantDeviceAccessToFamily(deviceId, familyCode);
      return toFamilyMember(member);
    }

    row.device_id = deviceId;
    row.role = role;
    row.relation_type = row.relation_type === RELATION_TYPE_HOME ? row.relation_type : relationType;
    row.joined_family = 1;
    row.revoked_at = null;
    row.updated_at = new Date().toISOString();
    mockFamilyMembers.set(key, row);
    familyService.grantDeviceAccessToFamily(deviceId, familyCode);
    return toFamilyMember(row);
  }

  await query(
    `INSERT INTO family_members (member_code, family_code, device_id, role, relation_type, joined_family)
     VALUES (?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       device_id = VALUES(device_id),
       role = VALUES(role),
       relation_type = IF(relation_type = 'home', relation_type, VALUES(relation_type)),
       joined_family = 1,
       revoked_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [deviceId, familyCode, deviceId, role, relationType]
  );

  return getFamilyMemberByCode(deviceId, familyCode);
}

async function joinFamily(memberCode, familyCode) {
  // joinFamily 用于“加入一个已经存在的家庭”。
  // 和 bindMemberToInitialFamily 不同，这里不会自动创建目标家庭；
  // 目标不存在就 404，避免用户输错家庭码时凭空建出一个家庭。
  const targetFamily = await familyService.getFamilyByCode(familyCode);

  if (!targetFamily) {
    throw createNotFoundError('目标家庭不存在');
  }

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const key = getMemberKey(familyCode, memberCode);
    const current = mockFamilyMembers.get(key);

    if (!current) {
      const row = {
        id: mockFamilyMembers.size + 1,
        member_code: memberCode,
        family_code: familyCode,
        device_id: null,
        role: 'member',
        relation_type: RELATION_TYPE_JOINED,
        joined_family: 1,
        revoked_at: null,
        created_at: now,
        updated_at: now
      };
      mockFamilyMembers.set(key, row);
      return toFamilyMember(row);
    }

    current.joined_family = 1;
    current.revoked_at = null;
    current.updated_at = now;
    mockFamilyMembers.set(key, current);
    return toFamilyMember(current);
  }

  const current = await getFamilyMemberByCode(memberCode, familyCode);

  if (!current) {
    await query(
      `INSERT INTO family_members (member_code, family_code, relation_type, joined_family)
       VALUES (?, ?, ?, 1)`,
      [memberCode, familyCode, RELATION_TYPE_JOINED]
    );
    return getFamilyMemberByCode(memberCode, familyCode);
  }

  await query(
    `UPDATE family_members
     SET joined_family = 1, revoked_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE member_code = ? AND family_code = ?`,
    [memberCode, familyCode]
  );

  return getFamilyMemberByCode(memberCode, familyCode);
}

async function joinFamilyByInvite(deviceId, inviteCode) {
  const familyCode = await familyService.consumeFamilyInvite(inviteCode);
  return bindDeviceToFamily(deviceId, familyCode, 'member');
}

async function findHomeFamilyMemberByDevice(deviceId) {
  if (env.useMockDb) {
    return toFamilyMember(
      Array.from(mockFamilyMembers.values()).find((member) => (
        member.device_id === deviceId
        && member.relation_type === RELATION_TYPE_HOME
        && !member.revoked_at
      ))
    );
  }

  const rows = await query(
    `SELECT id, member_code, family_code, device_id, member_name, title, avatar_url, role, relation_type, joined_family, revoked_at, created_at, updated_at
     FROM family_members
     WHERE device_id = ? AND relation_type = ? AND revoked_at IS NULL
     ORDER BY id ASC
     LIMIT 1`,
    [deviceId, RELATION_TYPE_HOME]
  );

  return toFamilyMember(rows[0]);
}

async function ensureHomeFamilyForDevice(deviceId) {
  const currentHome = await findHomeFamilyMemberByDevice(deviceId);

  if (currentHome) {
    return currentHome;
  }

  const currentMember = await getFamilyMemberByDevice(deviceId);

  if (currentMember) {
    if (env.useMockDb) {
      const key = getMemberKey(currentMember.familyCode, currentMember.memberCode);
      const row = mockFamilyMembers.get(key);
      row.relation_type = RELATION_TYPE_HOME;
      row.updated_at = new Date().toISOString();
      mockFamilyMembers.set(key, row);
      return toFamilyMember(row);
    }

    await query(
      `UPDATE family_members
       SET relation_type = ?, updated_at = CURRENT_TIMESTAMP
       WHERE family_code = ? AND device_id = ? AND revoked_at IS NULL`,
      [RELATION_TYPE_HOME, currentMember.familyCode, deviceId]
    );

    return getFamilyMemberByDevice(deviceId, currentMember.familyCode);
  }

  return null;
}

async function getFamilySummaryByDevice(deviceId) {
  if (env.useMockDb) {
    const members = Array.from(mockFamilyMembers.values())
      .filter((member) => member.device_id === deviceId && !member.revoked_at)
      .sort((a, b) => {
        if (a.relation_type === b.relation_type) {
          return a.id - b.id;
        }

        return a.relation_type === RELATION_TYPE_HOME ? -1 : 1;
      })
      .map(toFamilyMember);
    const families = await Promise.all(
      members.map(async (member) => familyService.getFamilyByCode(member.familyCode))
    );
    const homeMember = members.find((member) => member.isHomeFamily) || members[0] || null;

    return {
      homeFamilyCode: homeMember?.familyCode || null,
      familyCodeList: members.map((member) => member.familyCode),
      families: families
        .filter(Boolean)
        .map((family) => {
          const member = members.find((item) => item.familyCode === family.familyCode);

          return {
            ...family,
            relationType: member.relationType,
            isHomeFamily: member.isHomeFamily,
            role: member.role
          };
        })
    };
  }

  const rows = await query(
    `SELECT fm.id AS member_id,
            fm.member_code,
            fm.family_code,
            fm.device_id,
            fm.member_name,
            fm.title,
            fm.avatar_url AS member_avatar_url,
            fm.role,
            fm.relation_type,
            fm.joined_family,
            fm.revoked_at,
            fm.created_at AS member_created_at,
            fm.updated_at AS member_updated_at,
            f.id AS family_id,
            f.family_name,
            f.avatar_url,
            f.is_deleted,
            f.created_by_device_id,
            f.created_at,
            f.updated_at
     FROM family_members fm
     INNER JOIN families f ON f.family_code = fm.family_code AND f.is_deleted = 0
     WHERE fm.device_id = ? AND fm.revoked_at IS NULL
     ORDER BY CASE WHEN fm.relation_type = ? THEN 0 ELSE 1 END, fm.id ASC`,
    [deviceId, RELATION_TYPE_HOME]
  );

  const families = rows.map((row) => ({
    id: row.family_id,
    familyCode: row.family_code,
    familyName: row.family_name,
    avatarUrl: row.avatar_url || null,
    isDeleted: Boolean(row.is_deleted),
    createdByDeviceId: row.created_by_device_id || null,
    relationType: row.relation_type || RELATION_TYPE_JOINED,
    isHomeFamily: (row.relation_type || RELATION_TYPE_JOINED) === RELATION_TYPE_HOME,
    role: row.role || 'member',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
  const homeFamily = families.find((family) => family.isHomeFamily) || families[0] || null;

  return {
    homeFamilyCode: homeFamily?.familyCode || null,
    familyCodeList: families.map((family) => family.familyCode),
    families
  };
}

async function getFamilyMemberByCode(memberCode, familyCode = null) {
  // 所有按成员读取家庭共享数据的接口，第一步都会走这里。
  // 查不到 member，就说明这个 memberCode 还没有被任何家庭数据初始化/加入过。
  if (env.useMockDb) {
    if (familyCode) {
      return toFamilyMember(mockFamilyMembers.get(getMemberKey(familyCode, memberCode)));
    }

    return toFamilyMember(
      Array.from(mockFamilyMembers.values())
        .filter((member) => member.member_code === memberCode && !member.revoked_at)
        .sort((a, b) => {
          if (a.relation_type === b.relation_type) {
            return a.id - b.id;
          }

          return a.relation_type === RELATION_TYPE_HOME ? -1 : 1;
        })[0]
    );
  }

  const familyFilter = familyCode ? 'AND family_code = ?' : '';
  const params = familyCode ? [memberCode, familyCode] : [memberCode];
  const rows = await query(
    `SELECT id, member_code, family_code, device_id, member_name, title, avatar_url, role, relation_type, joined_family, revoked_at, created_at, updated_at
     FROM family_members
     WHERE member_code = ? AND revoked_at IS NULL ${familyFilter}
     ORDER BY CASE WHEN relation_type = ? THEN 0 ELSE 1 END, id ASC
     LIMIT 1`,
    [...params, RELATION_TYPE_HOME]
  );

  return toFamilyMember(rows[0]);
}

async function getFamilyMemberByDevice(deviceId, familyCode = null) {
  if (env.useMockDb) {
    return toFamilyMember(findMockMemberByDevice(deviceId, familyCode));
  }

  const familyFilter = familyCode ? 'AND family_code = ?' : '';
  const params = familyCode ? [deviceId, familyCode] : [deviceId];
  const rows = await query(
    `SELECT id, member_code, family_code, device_id, member_name, title, avatar_url, role, relation_type, joined_family, revoked_at, created_at, updated_at
     FROM family_members
     WHERE device_id = ? AND revoked_at IS NULL ${familyFilter}
     ORDER BY CASE WHEN relation_type = ? THEN 0 ELSE 1 END, id ASC
     LIMIT 1`,
    [...params, RELATION_TYPE_HOME]
  );

  return toFamilyMember(rows[0]);
}

async function listFamilyMembers(familyCode) {
  if (env.useMockDb) {
    return Array.from(mockFamilyMembers.values())
      .filter((member) => member.family_code === familyCode)
      .map(toFamilyMember);
  }

  const rows = await query(
    `SELECT id, member_code, family_code, device_id, member_name, title, avatar_url, role, relation_type, joined_family, revoked_at, created_at, updated_at
     FROM family_members
     WHERE family_code = ? AND revoked_at IS NULL
     ORDER BY id ASC`,
    [familyCode]
  );

  return rows.map(toFamilyMember);
}

async function updateFamilyMemberProfileByDevice(deviceId, familyCode, profile) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const normalized = {
    name: typeof profile.name === 'string' ? profile.name.trim() : null,
    title: typeof profile.title === 'string' ? profile.title.trim() : null,
    avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : null
  };

  if (env.useMockDb) {
    const row = mockFamilyMembers.get(getMemberKey(member.familyCode, member.memberCode));
    row.member_name = normalized.name || null;
    row.title = normalized.title || null;
    row.avatar_url = normalized.avatarUrl || null;
    row.updated_at = new Date().toISOString();
    mockFamilyMembers.set(getMemberKey(member.familyCode, member.memberCode), row);
    return toFamilyMember(row);
  }

  await query(
    `UPDATE family_members
     SET member_name = ?,
         title = ?,
         avatar_url = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND device_id = ? AND revoked_at IS NULL`,
    [
      normalized.name || null,
      normalized.title || null,
      normalized.avatarUrl || null,
      familyCode,
      deviceId
    ]
  );

  return getFamilyMemberByDevice(deviceId, familyCode);
}

async function leaveFamilyByDevice(deviceId, familyCode) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  if (member.relationType === RELATION_TYPE_HOME) {
    throw createConflictError('基础家庭不能退出');
  }

  if (env.useMockDb) {
    const row = mockFamilyMembers.get(getMemberKey(member.familyCode, member.memberCode));
    row.joined_family = 0;
    row.revoked_at = new Date().toISOString();
    row.updated_at = row.revoked_at;
    mockFamilyMembers.set(getMemberKey(member.familyCode, member.memberCode), row);
    familyService.revokeDeviceAccessFromFamily(deviceId, familyCode);
    return toFamilyMember(row);
  }

  await query(
    `UPDATE family_members
     SET joined_family = 0,
         revoked_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND device_id = ? AND revoked_at IS NULL`,
    [familyCode, deviceId]
  );

  return {
    ...member,
    joinedFamily: false,
    revokedAt: new Date()
  };
}

async function revokeFamilyMemberByDevice(deviceId, familyCode) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  if (env.useMockDb) {
    const row = mockFamilyMembers.get(getMemberKey(member.familyCode, member.memberCode));
    row.joined_family = 0;
    row.revoked_at = new Date().toISOString();
    row.updated_at = row.revoked_at;
    mockFamilyMembers.set(getMemberKey(member.familyCode, member.memberCode), row);
    familyService.revokeDeviceAccessFromFamily(deviceId, familyCode);
    return toFamilyMember(row);
  }

  await query(
    `UPDATE family_members
     SET joined_family = 0,
         revoked_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND device_id = ? AND revoked_at IS NULL`,
    [familyCode, deviceId]
  );

  familyService.revokeDeviceAccessFromFamily(deviceId, familyCode);
  return {
    ...member,
    joinedFamily: false,
    revokedAt: new Date()
  };
}

async function saveRecipeIngredients(familyCode, recipeId, ingredients) {
  if (env.useMockDb) {
    mockFamilyRecipeIngredients.set(getRecipeKey(familyCode, recipeId), ingredients);
    return;
  }

  await query(
    `DELETE FROM family_recipe_ingredients
     WHERE family_code = ? AND recipe_id = ?`,
    [familyCode, recipeId]
  );

  for (const [index, ingredient] of ingredients.entries()) {
    await query(
      `INSERT INTO family_recipe_ingredients
         (family_code, recipe_id, name, amount, is_seasoning, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        familyCode,
        recipeId,
        ingredient.name,
        ingredient.amount || null,
        ingredient.isSeasoning ? 1 : 0,
        Number.isInteger(ingredient.sortOrder) ? ingredient.sortOrder : index
      ]
    );
  }
}

async function getIngredientsByFamily(familyCode) {
  const result = new Map();

  if (env.useMockDb) {
    for (const [key, ingredients] of mockFamilyRecipeIngredients.entries()) {
      if (key.startsWith(`${familyCode}:`)) {
        result.set(key.slice(familyCode.length + 1), ingredients);
      }
    }

    return result;
  }

  const rows = await query(
    `SELECT recipe_id, name, amount, is_seasoning, sort_order
     FROM family_recipe_ingredients
     WHERE family_code = ?
     ORDER BY recipe_id ASC, sort_order ASC, id ASC`,
    [familyCode]
  );

  rows.forEach((row) => {
    const ingredients = result.get(row.recipe_id) || [];
    ingredients.push({
      name: row.name,
      amount: row.amount || '',
      isSeasoning: Boolean(row.is_seasoning)
    });
    result.set(row.recipe_id, ingredients);
  });

  return result;
}

async function getRecipeItemByFamily(familyCode, recipeId) {
  if (env.useMockDb) {
    const row = mockFamilyRecipes.get(getRecipeKey(familyCode, recipeId));

    if (!row || row.deleted_at) {
      return null;
    }

    return toRecipeItem(
      row,
      mockFamilyRecipeIngredients.get(getRecipeKey(familyCode, recipeId)) || []
    );
  }

  const rows = await query(
    `SELECT id, family_code, recipe_id, name, category, cover_url, difficulty, duration, favorite, own, steps_json, version, deleted_at, created_at, updated_at
     FROM family_recipes
     WHERE family_code = ? AND recipe_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [familyCode, recipeId]
  );

  if (!rows[0]) {
    return null;
  }

  const ingredientsByRecipe = await getIngredientsByFamily(familyCode);
  return toRecipeItem(rows[0], ingredientsByRecipe.get(recipeId) || []);
}

async function upsertRecipeItem(familyCode, memberCode, recipeItem, options = {}) {
  const parsed = typeof recipeItem === 'string' ? JSON.parse(recipeItem) : recipeItem;
  if (Array.isArray(parsed)) {
    throw new TypeError('单条菜谱接口只能提交一个菜谱对象');
  }

  const rawRecipe = parsed;
  const incomingId = rawRecipe && typeof rawRecipe === 'object'
    ? normalizeText(rawRecipe.id || rawRecipe._id || rawRecipe.recipeId)
    : '';
  const mode = options.mode || 'upsert';

  if (mode === 'update' && !incomingId) {
    throw new TypeError('更新菜谱必须带菜谱 ID');
  }

  const currentRecipe = incomingId ? await getRecipeItemByFamily(familyCode, incomingId) : null;

  if (mode === 'create' && currentRecipe) {
    throw createConflictError('菜谱已存在，不能重复新增');
  }

  if (mode === 'update' && !currentRecipe) {
    throw createNotFoundError('菜谱不存在');
  }

  const normalized = normalizeRecipeItem(recipeItem, currentRecipe);
  const coverUrl = normalizeCoverUrl(options.coverUrl) || normalized.coverUrl || null;

  if (env.useMockDb) {
    const key = getRecipeKey(familyCode, normalized.id);
    const current = mockFamilyRecipes.get(key);
    const now = new Date().toISOString();
    const row = {
      id: current?.id || mockFamilyRecipes.size + 1,
      family_code: familyCode,
      recipe_id: normalized.id,
      name: normalized.name,
      category: normalized.category || null,
      cover_url: coverUrl ?? current?.cover_url ?? null,
      difficulty: normalized.difficulty || null,
      duration: normalized.duration || null,
      favorite: normalized.favorite ? 1 : 0,
      own: normalized.own ? 1 : 0,
      steps_json: normalized.stepsJson,
      created_by: current?.created_by || memberCode,
      updated_by: memberCode,
      version: (current?.version || 0) + 1,
      deleted_at: null,
      created_at: current?.created_at || now,
      updated_at: now
    };

    mockFamilyRecipes.set(key, row);
    await saveRecipeIngredients(familyCode, normalized.id, normalized.ingredients);
    return toRecipeItem(row, normalized.ingredients);
  }

  await query(
    `INSERT INTO family_recipes
       (family_code, recipe_id, name, category, cover_url, difficulty, duration, favorite, own, steps_json, created_by, updated_by, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       category = VALUES(category),
       cover_url = VALUES(cover_url),
       difficulty = VALUES(difficulty),
       duration = VALUES(duration),
       favorite = VALUES(favorite),
       own = VALUES(own),
       steps_json = VALUES(steps_json),
       updated_by = VALUES(updated_by),
       version = version + 1,
       deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      familyCode,
      normalized.id,
      normalized.name,
      normalized.category || null,
      coverUrl,
      normalized.difficulty || null,
      normalized.duration || null,
      normalized.favorite ? 1 : 0,
      normalized.own ? 1 : 0,
      normalized.stepsJson,
      memberCode,
      memberCode
    ]
  );

  await saveRecipeIngredients(familyCode, normalized.id, normalized.ingredients);
  return getRecipeItemByFamily(familyCode, normalized.id);
}

async function upsertFamilyRecipe(familyCode, recipeJson, options = {}) {
  const recipes = normalizeRecipeCollectionInput(recipeJson);
  let lastRecipe = null;

  for (const item of recipes) {
    lastRecipe = await upsertRecipeItem(familyCode, options.memberCode || null, item, options);
  }

  return getFamilyRecipeByCode(familyCode, {
    lastRecipeId: lastRecipe?.id || null
  });
}

async function upsertFamilyRecipeByMember(memberCode, familyCode, recipeJson, options = {}) {
  // 上传菜谱时顺手完成成员和家庭的初始绑定。
  // 返回 member + recipe，是为了前端能同时拿到“我属于哪个家庭”和“当前家庭菜谱”。
  const member = await bindMemberToInitialFamily(memberCode, familyCode);
  const recipe = await upsertFamilyRecipe(member.familyCode, recipeJson, {
    ...options,
    memberCode: member.memberCode
  });

  return {
    member,
    recipe
  };
}

async function upsertFamilyRecipeByDevice(deviceId, familyCode, recipeJson, options = {}) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    throw createNotFoundError('当前设备还没有加入这个家庭');
  }

  const recipe = await upsertFamilyRecipe(member.familyCode, recipeJson, {
    ...options,
    memberCode: member.memberCode
  });

  return {
    member,
    recipe
  };
}

async function getFamilyRecipeItemByDevice(deviceId, familyCode, recipeId) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    throw createNotFoundError('当前设备还没有加入这个家庭');
  }

  const recipe = await getRecipeItemByFamily(member.familyCode, recipeId);

  if (!recipe) {
    return null;
  }

  return {
    member,
    recipe
  };
}

async function upsertFamilyRecipeItemByDevice(deviceId, familyCode, recipeItem, options = {}) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    throw createNotFoundError('当前设备还没有加入这个家庭');
  }

  const recipeItemResult = await upsertRecipeItem(
    member.familyCode,
    member.memberCode,
    recipeItem,
    options
  );
  const recipe = await getFamilyRecipeByCode(member.familyCode, {
    lastRecipeId: recipeItemResult.id
  });

  return {
    member,
    recipeItem: recipeItemResult,
    recipe
  };
}

async function deleteFamilyRecipeItemByDevice(deviceId, familyCode, recipeId) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    throw createNotFoundError('当前设备还没有加入这个家庭');
  }

  const current = await getRecipeItemByFamily(member.familyCode, recipeId);

  if (!current) {
    return null;
  }

  if (env.useMockDb) {
    const key = getRecipeKey(member.familyCode, recipeId);
    const row = mockFamilyRecipes.get(key);
    row.deleted_at = new Date().toISOString();
    row.updated_by = member.memberCode;
    row.version = (row.version || 0) + 1;
    row.updated_at = row.deleted_at;
    mockFamilyRecipes.set(key, row);

    return {
      member,
      recipe: toRecipeItem(
        row,
        mockFamilyRecipeIngredients.get(key) || []
      )
    };
  }

  await query(
    `UPDATE family_recipes
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_by = ?,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND recipe_id = ? AND deleted_at IS NULL`,
    [member.memberCode, member.familyCode, recipeId]
  );

  return {
    member,
    recipe: {
      ...current,
      deleted: true,
      deletedAt: new Date()
    }
  };
}

async function updateFamilyRecipeCoverByDevice(deviceId, familyCode, coverUrl) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    throw createNotFoundError('当前设备还没有加入这个家庭');
  }

  const normalizedCoverUrl = normalizeCoverUrl(coverUrl);

  if (env.useMockDb) {
    const current = Array.from(mockFamilyRecipes.values())
      .filter((row) => row.family_code === member.familyCode && !row.deleted_at)
      .sort((a, b) => a.id - b.id)[0];

    if (current) {
      current.cover_url = normalizedCoverUrl;
      current.updated_at = new Date().toISOString();
      mockFamilyRecipes.set(getRecipeKey(member.familyCode, current.recipe_id), current);
    }

    return {
      member,
      recipe: await getFamilyRecipeByCode(member.familyCode)
    };
  }

  await query(
    `UPDATE family_recipes
     SET cover_url = ?, updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND deleted_at IS NULL
     ORDER BY id ASC
     LIMIT 1`,
    [normalizedCoverUrl, member.familyCode]
  );

  return {
    member,
    recipe: await getFamilyRecipeByCode(member.familyCode)
  };
}

async function getFamilyRecipeByCode(familyCode) {
  if (env.useMockDb) {
    const recipes = Array.from(mockFamilyRecipes.values())
      .filter((row) => row.family_code === familyCode && !row.deleted_at)
      .sort((a, b) => a.id - b.id)
      .map((row) => toRecipeItem(
        row,
        mockFamilyRecipeIngredients.get(getRecipeKey(familyCode, row.recipe_id)) || []
      ));

    return recipes.length ? toFamilyRecipe(familyCode, recipes) : null;
  }

  const rows = await query(
    `SELECT id, family_code, recipe_id, name, category, cover_url, difficulty, duration, favorite, own, steps_json, version, deleted_at, created_at, updated_at
     FROM family_recipes
     WHERE family_code = ? AND deleted_at IS NULL
     ORDER BY id ASC`,
    [familyCode]
  );

  if (!rows.length) {
    return null;
  }

  const ingredientsByRecipe = await getIngredientsByFamily(familyCode);
  const recipes = rows.map((row) => toRecipeItem(
    row,
    ingredientsByRecipe.get(row.recipe_id) || []
  ));

  return toFamilyRecipe(familyCode, recipes);
}

async function getFamilyRecipeByMember(memberCode) {
  // 按 memberCode 查菜谱时，不直接相信客户端传 familyCode。
  // 后端从 family_members 找到真实 familyCode，再读取这个家庭的菜谱。
  const member = await getFamilyMemberByCode(memberCode);

  if (!member) {
    return null;
  }

  const recipe = await getFamilyRecipeByCode(member.familyCode);

  if (!recipe) {
    return {
      member,
      recipe: null
    };
  }

  return {
    member,
    recipe
  };
}

async function getFamilyRecipeByDevice(deviceId, familyCode = null) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const recipe = await getFamilyRecipeByCode(member.familyCode);

  return {
    member,
    recipe
  };
}

module.exports = {
  bindMemberToInitialFamily,
  bindDeviceToFamily,
  joinFamily,
  joinFamilyByInvite,
  ensureHomeFamilyForDevice,
  getFamilySummaryByDevice,
  getFamilyMemberByCode,
  getFamilyMemberByDevice,
  listFamilyMembers,
  updateFamilyMemberProfileByDevice,
  leaveFamilyByDevice,
  revokeFamilyMemberByDevice,
  upsertFamilyRecipe,
  upsertFamilyRecipeByMember,
  upsertFamilyRecipeByDevice,
  getFamilyRecipeItemByDevice,
  upsertFamilyRecipeItemByDevice,
  deleteFamilyRecipeItemByDevice,
  updateFamilyRecipeCoverByDevice,
  getFamilyRecipeByCode,
  getFamilyRecipeByMember,
  getFamilyRecipeByDevice
};
