const { query } = require('../config/db');
const { env } = require('../config/env');
const familyService = require('./family.service');

const mockFamilyRecipes = new Map();
const mockFamilyMembers = new Map();

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
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    memberCode: row.member_code,
    familyCode: row.family_code,
    joinedFamily: Boolean(row.joined_family),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function bindMemberToInitialFamily(memberCode, familyCode) {
  await familyService.ensureFamilyExists(familyCode);

  if (env.useMockDb) {
    const current = mockFamilyMembers.get(memberCode);

    if (current && current.family_code !== familyCode) {
      throw createConflictError('memberCode is already bound to another familyCode');
    }

    const now = new Date().toISOString();
    const row = current || {
      id: mockFamilyMembers.size + 1,
      member_code: memberCode,
      family_code: familyCode,
      joined_family: 0,
      created_at: now,
      updated_at: now
    };

    mockFamilyMembers.set(memberCode, row);
    return toFamilyMember(row);
  }

  await query(
    `INSERT INTO family_members (member_code, family_code)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       family_code = IF(family_code = VALUES(family_code), family_code, family_code)`,
    [memberCode, familyCode]
  );

  const member = await getFamilyMemberByCode(memberCode);

  if (member.familyCode !== familyCode) {
    throw createConflictError('memberCode is already bound to another familyCode');
  }

  return member;
}

async function joinFamily(memberCode, familyCode) {
  const targetFamily = await familyService.getFamilyByCode(familyCode);

  if (!targetFamily) {
    throw createNotFoundError('target familyCode does not exist');
  }

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const current = mockFamilyMembers.get(memberCode);

    if (!current) {
      const row = {
        id: mockFamilyMembers.size + 1,
        member_code: memberCode,
        family_code: familyCode,
        joined_family: 1,
        created_at: now,
        updated_at: now
      };
      mockFamilyMembers.set(memberCode, row);
      return toFamilyMember(row);
    }

    if (current.family_code !== familyCode && current.joined_family) {
      throw createConflictError('memberCode has already joined a family and cannot change familyCode');
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
    throw createConflictError('memberCode has already joined a family and cannot change familyCode');
  }

  await query(
    `UPDATE family_members
     SET family_code = ?, joined_family = 1
     WHERE member_code = ?`,
    [familyCode, memberCode]
  );

  return getFamilyMemberByCode(memberCode);
}

async function getFamilyMemberByCode(memberCode) {
  if (env.useMockDb) {
    return toFamilyMember(mockFamilyMembers.get(memberCode));
  }

  const rows = await query(
    `SELECT id, member_code, family_code, joined_family, created_at, updated_at
     FROM family_members
     WHERE member_code = ?`,
    [memberCode]
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
    `SELECT id, member_code, family_code, joined_family, created_at, updated_at
     FROM family_members
     WHERE family_code = ?
     ORDER BY id ASC`,
    [familyCode]
  );

  return rows.map(toFamilyMember);
}

async function upsertFamilyRecipe(familyCode, recipeJson) {
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
  const member = await bindMemberToInitialFamily(memberCode, familyCode);
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

module.exports = {
  bindMemberToInitialFamily,
  joinFamily,
  getFamilyMemberByCode,
  listFamilyMembers,
  upsertFamilyRecipe,
  upsertFamilyRecipeByMember,
  getFamilyRecipeByCode,
  getFamilyRecipeByMember
};
