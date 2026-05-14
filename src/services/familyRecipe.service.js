const { query } = require('../config/db');
const { env } = require('../config/env');
const familyService = require('./family.service');

const mockFamilyRecipes = new Map();
const mockFamilyMembers = new Map();

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

function normalizeRecipeJson(recipeJson) {
  // 菜谱目前仍按“一个家庭一整份 JSON”存储。
  // 如果调用方传字符串，就先 JSON.parse 验证它合法，再原样入库；
  // 如果调用方传对象，就 stringify 后入库。
  if (recipeJson === undefined || recipeJson === null) {
    return null;
  }

  if (typeof recipeJson === 'string') {
    JSON.parse(recipeJson);
    return recipeJson;
  }

  return JSON.stringify(recipeJson);
}

function parseRecipeJson(recipeJson) {
  try {
    return JSON.parse(recipeJson);
  } catch (error) {
    return recipeJson;
  }
}

function toFamilyRecipe(row) {
  // 数据库字段是 snake_case，接口返回统一转成 camelCase。
  // recipeJson 会尽量解析回对象，便于前端直接使用。
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    familyCode: row.family_code,
    recipeJson: parseRecipeJson(row.recipe_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
    role: row.role || 'member',
    joinedFamily: Boolean(row.joined_family),
    revokedAt: row.revoked_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function findMockMemberByDevice(deviceId, familyCode = null) {
  return Array.from(mockFamilyMembers.values()).find((member) => {
    if (member.device_id !== deviceId || member.revoked_at) {
      return false;
    }

    return familyCode ? member.family_code === familyCode : true;
  });
}

async function bindMemberToInitialFamily(memberCode, familyCode, options = {}) {
  // 首次上传家庭数据时，允许自动创建家庭并把 memberCode 绑定进去。
  // 这是为了降低客户端接入成本：前端只要带 memberCode + familyCode + 数据，就能完成初始化。
  await familyService.ensureFamilyExists(familyCode);

  if (env.useMockDb) {
    const current = mockFamilyMembers.get(memberCode) || findMockMemberByDevice(options.deviceId, familyCode);

    if (current && current.family_code !== familyCode) {
      throw createConflictError('这个成员已经加入了其他家庭');
    }

    const now = new Date().toISOString();
    const row = current || {
      id: mockFamilyMembers.size + 1,
      member_code: memberCode,
      family_code: familyCode,
      device_id: options.deviceId || null,
      role: options.role || 'member',
      joined_family: 0,
      revoked_at: null,
      created_at: now,
      updated_at: now
    };

    mockFamilyMembers.set(memberCode, row);
    return toFamilyMember(row);
  }

  await query(
    `INSERT INTO family_members (member_code, family_code, device_id, role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       family_code = IF(family_code = VALUES(family_code), family_code, family_code),
       device_id = IF(device_id IS NULL, VALUES(device_id), device_id)`,
    [memberCode, familyCode, options.deviceId || null, options.role || 'member']
  );

  // 上面的 SQL 故意不允许已有 memberCode 被悄悄改到另一个家庭。
  // 所以插入后再查一次：如果查出来的 familyCode 和请求不一致，就返回冲突。
  const member = await getFamilyMemberByCode(memberCode);

  if (member.familyCode !== familyCode) {
    throw createConflictError('这个成员已经加入了其他家庭');
  }

  return member;
}

async function bindDeviceToFamily(deviceId, familyCode, role = 'member') {
  const member = await bindMemberToInitialFamily(deviceId, familyCode, {
    deviceId,
    role
  });
  familyService.grantDeviceAccessToFamily(deviceId, familyCode);

  if (env.useMockDb) {
    const row = mockFamilyMembers.get(member.memberCode);
    row.joined_family = 1;
    row.updated_at = new Date().toISOString();
    mockFamilyMembers.set(member.memberCode, row);
    return toFamilyMember(row);
  }

  await query(
    `UPDATE family_members
     SET joined_family = 1
     WHERE member_code = ?`,
    [member.memberCode]
  );

  return getFamilyMemberByCode(member.memberCode);
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
    const current = mockFamilyMembers.get(memberCode);

    if (!current) {
      const row = {
        id: mockFamilyMembers.size + 1,
        member_code: memberCode,
        family_code: familyCode,
        device_id: null,
        role: 'member',
        joined_family: 1,
        revoked_at: null,
        created_at: now,
        updated_at: now
      };
      mockFamilyMembers.set(memberCode, row);
      return toFamilyMember(row);
    }

    if (current.family_code !== familyCode && current.joined_family) {
      throw createConflictError('这个成员已经加入家庭，不能切换到其他家庭');
    }

    current.family_code = familyCode;
    current.joined_family = 1;
    current.updated_at = now;
    mockFamilyMembers.set(memberCode, current);
    return toFamilyMember(current);
  }

  const current = await getFamilyMemberByCode(memberCode);

  if (!current) {
    await query(
      `INSERT INTO family_members (member_code, family_code, joined_family)
       VALUES (?, ?, 1)`,
      [memberCode, familyCode]
    );
    return getFamilyMemberByCode(memberCode);
  }

  if (current.familyCode !== familyCode && current.joinedFamily) {
    throw createConflictError('这个成员已经加入家庭，不能切换到其他家庭');
  }

  await query(
    `UPDATE family_members
     SET family_code = ?, joined_family = 1
     WHERE member_code = ?`,
    [familyCode, memberCode]
  );

  return getFamilyMemberByCode(memberCode);
}

async function joinFamilyByInvite(deviceId, inviteCode) {
  const familyCode = await familyService.consumeFamilyInvite(inviteCode);
  return bindDeviceToFamily(deviceId, familyCode, 'member');
}

async function getFamilyMemberByCode(memberCode) {
  // 所有按成员读取家庭共享数据的接口，第一步都会走这里。
  // 查不到 member，就说明这个 memberCode 还没有被任何家庭数据初始化/加入过。
  if (env.useMockDb) {
    return toFamilyMember(mockFamilyMembers.get(memberCode));
  }

  const rows = await query(
    `SELECT id, member_code, family_code, device_id, role, joined_family, revoked_at, created_at, updated_at
     FROM family_members
     WHERE member_code = ? AND revoked_at IS NULL`,
    [memberCode]
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
    `SELECT id, member_code, family_code, device_id, role, joined_family, revoked_at, created_at, updated_at
     FROM family_members
     WHERE device_id = ? AND revoked_at IS NULL ${familyFilter}
     ORDER BY id ASC
     LIMIT 1`,
    params
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
    `SELECT id, member_code, family_code, device_id, role, joined_family, revoked_at, created_at, updated_at
     FROM family_members
     WHERE family_code = ? AND revoked_at IS NULL
     ORDER BY id ASC`,
    [familyCode]
  );

  return rows.map(toFamilyMember);
}

async function upsertFamilyRecipe(familyCode, recipeJson) {
  // family_recipes 是 family_code 唯一。
  // 同一个家庭再次上传菜谱时，整份 recipe_json 会覆盖旧值。
  // 购物清单/食材库没有沿用这个模式，因为它们需要 item 级同步和软删除。
  const normalizedRecipeJson = normalizeRecipeJson(recipeJson);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const current = mockFamilyRecipes.get(familyCode);
    const row = {
      id: current?.id || mockFamilyRecipes.size + 1,
      family_code: familyCode,
      recipe_json: normalizedRecipeJson,
      created_at: current?.created_at || now,
      updated_at: now
    };

    mockFamilyRecipes.set(familyCode, row);
    return toFamilyRecipe(row);
  }

  await query(
    `INSERT INTO family_recipes (family_code, recipe_json)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       recipe_json = VALUES(recipe_json),
       updated_at = CURRENT_TIMESTAMP`,
    [familyCode, normalizedRecipeJson]
  );

  return getFamilyRecipeByCode(familyCode);
}

async function upsertFamilyRecipeByMember(memberCode, familyCode, recipeJson) {
  // 上传菜谱时顺手完成成员和家庭的初始绑定。
  // 返回 member + recipe，是为了前端能同时拿到“我属于哪个家庭”和“当前家庭菜谱”。
  const member = await bindMemberToInitialFamily(memberCode, familyCode);
  const recipe = await upsertFamilyRecipe(member.familyCode, recipeJson);

  return {
    member,
    recipe
  };
}

async function upsertFamilyRecipeByDevice(deviceId, familyCode, recipeJson) {
  const member = await getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    throw createNotFoundError('当前设备还没有加入这个家庭');
  }

  const recipe = await upsertFamilyRecipe(member.familyCode, recipeJson);

  return {
    member,
    recipe
  };
}

async function getFamilyRecipeByCode(familyCode) {
  if (env.useMockDb) {
    return toFamilyRecipe(mockFamilyRecipes.get(familyCode));
  }

  const rows = await query(
    `SELECT id, family_code, recipe_json, created_at, updated_at
     FROM family_recipes
     WHERE family_code = ?`,
    [familyCode]
  );

  return toFamilyRecipe(rows[0]);
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

async function getFamilyRecipeByDevice(deviceId) {
  const member = await getFamilyMemberByDevice(deviceId);

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
  getFamilyMemberByCode,
  getFamilyMemberByDevice,
  listFamilyMembers,
  upsertFamilyRecipe,
  upsertFamilyRecipeByMember,
  upsertFamilyRecipeByDevice,
  getFamilyRecipeByCode,
  getFamilyRecipeByMember,
  getFamilyRecipeByDevice
};
