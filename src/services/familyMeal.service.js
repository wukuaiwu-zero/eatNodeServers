const { pool, query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

const PLAN_TABLE = 'family_daily_meal_plans';
const PLAN_ITEM_TABLE = 'family_daily_meal_items';
const COMMON_TABLE = 'family_meal_common_items';
const TEMP_TABLE = 'family_meal_temp_items';

const DEFAULT_MEAL_NAMES = ['早餐', '午餐', '晚餐'];

const mockPlans = new Map();
const mockPlanItems = new Map();
const mockCommonItems = new Map();
const mockTempItems = new Map();

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDate(value) {
  const text = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new TypeError('日期格式必须是 YYYY-MM-DD');
  }

  return text;
}

function normalizeDone(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'number') {
    return value ? 1 : 0;
  }

  return ['1', 'true', 'yes', 'done', '已完成'].includes(String(value).trim().toLowerCase()) ? 1 : 0;
}

function getMealName(input) {
  const mealName = normalizeText(input?.mealName || input?.meal_name || input?.name || input);

  if (!mealName) {
    throw new TypeError('请填写餐次名称');
  }

  if (mealName.length > 50) {
    throw new TypeError('餐次名称太长了，不能超过 50 个字符');
  }

  return mealName;
}

function getRecipeName(input) {
  const recipeName = normalizeText(input?.recipeName || input?.recipe_name || input?.name || input?.title || input);

  if (!recipeName) {
    throw new TypeError('请填写菜品名称');
  }

  if (recipeName.length > 100) {
    throw new TypeError('菜品名称太长了，不能超过 100 个字符');
  }

  return recipeName;
}

function uniqueRecipeNames(values = []) {
  const names = [];
  const seen = new Set();

  values.forEach((value) => {
    const recipeName = getRecipeName(value);
    if (!seen.has(recipeName)) {
      seen.add(recipeName);
      names.push(recipeName);
    }
  });

  return names;
}

function normalizeMealList(mealsInput) {
  const parsed = typeof mealsInput === 'string' ? JSON.parse(mealsInput) : mealsInput;

  if (!Array.isArray(parsed)) {
    throw new TypeError('三餐数组格式不正确');
  }

  const seenMeals = new Set();

  return parsed.map((meal) => {
    const mealName = getMealName(meal);
    const recipesInput = meal.recipes || meal.recipeNames || meal.recipe_names || meal.items || [];

    if (seenMeals.has(mealName)) {
      throw new TypeError('同一天不能重复提交相同餐次');
    }

    seenMeals.add(mealName);

    if (!Array.isArray(recipesInput)) {
      throw new TypeError('菜品列表格式不正确');
    }

    return {
      mealName,
      done: normalizeDone(meal.done ?? meal.finished ?? meal.completed, 0),
      recipes: uniqueRecipeNames(recipesInput)
    };
  });
}

function planKey(familyCode, date, mealName) {
  return `${familyCode}:${date}:${mealName}`;
}

function itemKey(familyCode, date, mealName, recipeName) {
  return `${familyCode}:${date}:${mealName}:${recipeName}`;
}

function commonKey(familyCode, mealName, recipeName) {
  return `${familyCode}:${mealName}:${recipeName}`;
}

function tempKey(familyCode, date, mealName, recipeName) {
  return `${familyCode}:${date}:${mealName}:${recipeName}`;
}

function toMeal(row, recipes = []) {
  return {
    mealName: row.meal_name,
    meal_name: row.meal_name,
    done: Number(row.done) ? 1 : 0,
    recipes
  };
}

function toPlan(familyCode, date, meals) {
  return {
    familyCode,
    family_code: familyCode,
    date,
    meals
  };
}

function groupRecipeRows(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const mealName = row.meal_name;
    if (!grouped.has(mealName)) {
      grouped.set(mealName, {
        meal_name: mealName,
        done: row.done || 0,
        recipes: []
      });
    }

    if (row.recipe_name) {
      grouped.get(mealName).recipes.push(row.recipe_name);
    }
  });

  return grouped;
}

async function withTransaction(callback) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listPlanByFamily(familyCode, dateInput) {
  const date = normalizeDate(dateInput);

  if (env.useMockDb) {
    const plans = Array.from(mockPlans.values())
      .filter((row) => row.family_code === familyCode && row.plan_date === date);
    const items = Array.from(mockPlanItems.values())
      .filter((row) => row.family_code === familyCode && row.plan_date === date)
      .sort((a, b) => a.sort_order - b.sort_order);
    const grouped = groupRecipeRows(items);

    plans.forEach((row) => {
      if (!grouped.has(row.meal_name)) {
        grouped.set(row.meal_name, { ...row, recipes: [] });
      } else {
        grouped.get(row.meal_name).done = row.done;
      }
    });

    return toPlan(familyCode, date, Array.from(grouped.values()).map((row) => toMeal(row, row.recipes)));
  }

  const planRows = await query(
    `SELECT meal_name, done
     FROM ${PLAN_TABLE}
     WHERE family_code = ? AND plan_date = ?
     ORDER BY FIELD(meal_name, '早餐', '午餐', '晚餐'), meal_name ASC`,
    [familyCode, date]
  );
  const itemRows = await query(
    `SELECT meal_name, recipe_name, sort_order
     FROM ${PLAN_ITEM_TABLE}
     WHERE family_code = ? AND plan_date = ?
     ORDER BY FIELD(meal_name, '早餐', '午餐', '晚餐'), meal_name ASC, sort_order ASC, id ASC`,
    [familyCode, date]
  );
  const grouped = groupRecipeRows(itemRows);

  planRows.forEach((row) => {
    if (!grouped.has(row.meal_name)) {
      grouped.set(row.meal_name, { ...row, recipes: [] });
    } else {
      grouped.get(row.meal_name).done = row.done;
    }
  });

  return toPlan(familyCode, date, Array.from(grouped.values()).map((row) => toMeal(row, row.recipes)));
}

async function listPlanByDevice(deviceId, familyCode, date) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return { member, plan: await listPlanByFamily(member.familyCode, date) };
}

async function savePlanByFamily(familyCode, memberCode, dateInput, mealsInput) {
  const date = normalizeDate(dateInput);
  const meals = normalizeMealList(mealsInput);

  if (env.useMockDb) {
    Array.from(mockPlans.keys())
      .filter((key) => key.startsWith(`${familyCode}:${date}:`))
      .forEach((key) => mockPlans.delete(key));
    Array.from(mockPlanItems.keys())
      .filter((key) => key.startsWith(`${familyCode}:${date}:`))
      .forEach((key) => mockPlanItems.delete(key));

    const now = new Date().toISOString();
    meals.forEach((meal) => {
      mockPlans.set(planKey(familyCode, date, meal.mealName), {
        family_code: familyCode,
        plan_date: date,
        meal_name: meal.mealName,
        done: meal.done,
        updated_by: memberCode,
        created_at: now,
        updated_at: now
      });
      meal.recipes.forEach((recipeName, index) => {
        mockPlanItems.set(itemKey(familyCode, date, meal.mealName, recipeName), {
          family_code: familyCode,
          plan_date: date,
          meal_name: meal.mealName,
          recipe_name: recipeName,
          sort_order: index,
          created_by: memberCode,
          created_at: now
        });
      });
    });

    return listPlanByFamily(familyCode, date);
  }

  await withTransaction(async (connection) => {
    await connection.execute(
      `DELETE FROM ${PLAN_ITEM_TABLE} WHERE family_code = ? AND plan_date = ?`,
      [familyCode, date]
    );
    await connection.execute(
      `DELETE FROM ${PLAN_TABLE} WHERE family_code = ? AND plan_date = ?`,
      [familyCode, date]
    );

    for (const meal of meals) {
      await connection.execute(
        `INSERT INTO ${PLAN_TABLE}
           (family_code, plan_date, meal_name, done, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [familyCode, date, meal.mealName, meal.done, memberCode, memberCode]
      );

      for (let index = 0; index < meal.recipes.length; index += 1) {
        await connection.execute(
          `INSERT INTO ${PLAN_ITEM_TABLE}
             (family_code, plan_date, meal_name, recipe_name, sort_order, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [familyCode, date, meal.mealName, meal.recipes[index], index, memberCode]
        );
      }
    }
  });

  return listPlanByFamily(familyCode, date);
}

async function savePlanByDevice(deviceId, familyCode, date, meals) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return { member, plan: await savePlanByFamily(member.familyCode, member.memberCode, date, meals) };
}

async function updateMealStatusByFamily(familyCode, memberCode, dateInput, mealNameInput, doneInput) {
  const date = normalizeDate(dateInput);
  const mealName = getMealName(mealNameInput);
  const done = normalizeDone(doneInput, 0);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const key = planKey(familyCode, date, mealName);
    const current = mockPlans.get(key);
    mockPlans.set(key, {
      family_code: familyCode,
      plan_date: date,
      meal_name: mealName,
      done,
      created_by: current?.created_by || memberCode,
      updated_by: memberCode,
      created_at: current?.created_at || now,
      updated_at: now
    });
    return listPlanByFamily(familyCode, date);
  }

  await query(
    `INSERT INTO ${PLAN_TABLE}
       (family_code, plan_date, meal_name, done, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       done = VALUES(done),
       updated_by = VALUES(updated_by),
       updated_at = CURRENT_TIMESTAMP`,
    [familyCode, date, mealName, done, memberCode, memberCode]
  );

  return listPlanByFamily(familyCode, date);
}

async function updateMealStatusByDevice(deviceId, familyCode, date, mealName, done) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return {
    member,
    plan: await updateMealStatusByFamily(member.familyCode, member.memberCode, date, mealName, done)
  };
}

function emptyMealBuckets() {
  return DEFAULT_MEAL_NAMES.reduce((result, mealName) => {
    result[mealName] = [];
    return result;
  }, {});
}

function groupMenuRows(rows) {
  return rows.reduce((result, row) => {
    if (!result[row.meal_name]) {
      result[row.meal_name] = [];
    }
    result[row.meal_name].push(row.recipe_name);
    return result;
  }, emptyMealBuckets());
}

async function listCommonByFamily(familyCode) {
  if (env.useMockDb) {
    return groupMenuRows(
      Array.from(mockCommonItems.values())
        .filter((row) => row.family_code === familyCode)
        .sort((a, b) => a.id - b.id)
    );
  }

  const rows = await query(
    `SELECT meal_name, recipe_name
     FROM ${COMMON_TABLE}
     WHERE family_code = ?
     ORDER BY FIELD(meal_name, '早餐', '午餐', '晚餐'), meal_name ASC, id ASC`,
    [familyCode]
  );

  return groupMenuRows(rows);
}

async function listCommonByDevice(deviceId, familyCode) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return { member, commonMenus: await listCommonByFamily(member.familyCode) };
}

async function addCommonByFamily(familyCode, memberCode, mealNameInput, recipeNameInput) {
  const mealName = getMealName(mealNameInput);
  const recipeName = getRecipeName(recipeNameInput);

  if (env.useMockDb) {
    const key = commonKey(familyCode, mealName, recipeName);
    if (!mockCommonItems.has(key)) {
      const now = new Date().toISOString();
      mockCommonItems.set(key, {
        id: mockCommonItems.size + 1,
        family_code: familyCode,
        meal_name: mealName,
        recipe_name: recipeName,
        created_by: memberCode,
        created_at: now
      });
    }
    return listCommonByFamily(familyCode);
  }

  await query(
    `INSERT IGNORE INTO ${COMMON_TABLE}
       (family_code, meal_name, recipe_name, created_by)
     VALUES (?, ?, ?, ?)`,
    [familyCode, mealName, recipeName, memberCode]
  );

  return listCommonByFamily(familyCode);
}

async function addCommonByDevice(deviceId, familyCode, mealName, recipeName) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return { member, commonMenus: await addCommonByFamily(member.familyCode, member.memberCode, mealName, recipeName) };
}

async function removeCommonByFamily(familyCode, mealNameInput, recipeNameInput) {
  const mealName = getMealName(mealNameInput);
  const recipeName = getRecipeName(recipeNameInput);

  if (env.useMockDb) {
    const deleted = mockCommonItems.delete(commonKey(familyCode, mealName, recipeName));
    if (!deleted) {
      throw createNotFoundError('常用菜单菜品不存在');
    }
    return listCommonByFamily(familyCode);
  }

  const result = await query(
    `DELETE FROM ${COMMON_TABLE}
     WHERE family_code = ? AND meal_name = ? AND recipe_name = ?`,
    [familyCode, mealName, recipeName]
  );

  if (!result.affectedRows) {
    throw createNotFoundError('常用菜单菜品不存在');
  }

  return listCommonByFamily(familyCode);
}

async function removeCommonByDevice(deviceId, familyCode, mealName, recipeName) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return { member, commonMenus: await removeCommonByFamily(member.familyCode, mealName, recipeName) };
}

async function listTempByFamily(familyCode, dateInput) {
  const date = normalizeDate(dateInput);

  if (env.useMockDb) {
    return groupMenuRows(
      Array.from(mockTempItems.values())
        .filter((row) => row.family_code === familyCode && row.plan_date === date)
        .sort((a, b) => a.id - b.id)
    );
  }

  const rows = await query(
    `SELECT meal_name, recipe_name
     FROM ${TEMP_TABLE}
     WHERE family_code = ? AND plan_date = ?
     ORDER BY FIELD(meal_name, '早餐', '午餐', '晚餐'), meal_name ASC, id ASC`,
    [familyCode, date]
  );

  return groupMenuRows(rows);
}

async function listTempByDevice(deviceId, familyCode, date) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return { member, tempMenus: await listTempByFamily(member.familyCode, date) };
}

async function addTempByFamily(familyCode, memberCode, dateInput, mealNameInput, recipeNameInput) {
  const date = normalizeDate(dateInput);
  const mealName = getMealName(mealNameInput);
  const recipeName = getRecipeName(recipeNameInput);

  if (env.useMockDb) {
    const key = tempKey(familyCode, date, mealName, recipeName);
    if (!mockTempItems.has(key)) {
      const now = new Date().toISOString();
      mockTempItems.set(key, {
        id: mockTempItems.size + 1,
        family_code: familyCode,
        plan_date: date,
        meal_name: mealName,
        recipe_name: recipeName,
        created_by: memberCode,
        created_at: now
      });
    }
    return listTempByFamily(familyCode, date);
  }

  await query(
    `INSERT IGNORE INTO ${TEMP_TABLE}
       (family_code, plan_date, meal_name, recipe_name, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [familyCode, date, mealName, recipeName, memberCode]
  );

  return listTempByFamily(familyCode, date);
}

async function addTempByDevice(deviceId, familyCode, date, mealName, recipeName) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return { member, tempMenus: await addTempByFamily(member.familyCode, member.memberCode, date, mealName, recipeName) };
}

async function removeTempByFamily(familyCode, dateInput, mealNameInput, recipeNameInput) {
  const date = normalizeDate(dateInput);
  const mealName = getMealName(mealNameInput);
  const recipeName = getRecipeName(recipeNameInput);

  if (env.useMockDb) {
    const deleted = mockTempItems.delete(tempKey(familyCode, date, mealName, recipeName));
    if (!deleted) {
      throw createNotFoundError('临时菜品不存在');
    }
    return listTempByFamily(familyCode, date);
  }

  const result = await query(
    `DELETE FROM ${TEMP_TABLE}
     WHERE family_code = ? AND plan_date = ? AND meal_name = ? AND recipe_name = ?`,
    [familyCode, date, mealName, recipeName]
  );

  if (!result.affectedRows) {
    throw createNotFoundError('临时菜品不存在');
  }

  return listTempByFamily(familyCode, date);
}

async function removeTempByDevice(deviceId, familyCode, date, mealName, recipeName) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return { member, tempMenus: await removeTempByFamily(member.familyCode, date, mealName, recipeName) };
}

module.exports = {
  listPlanByDevice,
  savePlanByDevice,
  updateMealStatusByDevice,
  listCommonByDevice,
  addCommonByDevice,
  removeCommonByDevice,
  listTempByDevice,
  addTempByDevice,
  removeTempByDevice
};
