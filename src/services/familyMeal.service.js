const { pool, query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

const PLAN_TABLE = 'family_daily_meal_plans';
const PLAN_ITEM_TABLE = 'family_daily_meal_items';
const COMMON_TABLE = 'family_meal_common_items';
const TEMP_TABLE = 'family_meal_temp_items';
const PLAN_COLUMNS = 'meal_name, done, record_json';

const DEFAULT_MEAL_NAMES = ['早餐', '午餐', '晚餐'];
const MEAL_RECORD_SOURCES = new Set(['自己做', '做饭', '外卖', '叫外卖', '出去吃']);
const MAX_RECORD_TEXT_LENGTH = 500;
let mealRecordColumnReadyPromise = null;

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

function parseJsonSafely(value, fallback = null) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (error) {
    return fallback;
  }
}

async function ensureMealRecordColumn() {
  if (env.useMockDb) {
    return;
  }

  if (!mealRecordColumnReadyPromise) {
    mealRecordColumnReadyPromise = (async () => {
      const rows = await query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = 'record_json'
         LIMIT 1`,
        [PLAN_TABLE]
      );

      if (!rows.length) {
        try {
          await query(`ALTER TABLE ${PLAN_TABLE} ADD COLUMN record_json LONGTEXT DEFAULT NULL AFTER done`);
        } catch (error) {
          if (error.code !== 'ER_DUP_FIELDNAME') {
            throw error;
          }
        }
      }
    })().catch((error) => {
      mealRecordColumnReadyPromise = null;
      throw error;
    });
  }

  await mealRecordColumnReadyPromise;
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

function normalizeStringList(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const parsed = typeof value === 'string' ? JSON.parse(value) : value;

  if (!Array.isArray(parsed)) {
    throw new TypeError(`${fieldName}格式不正确`);
  }

  return parsed
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeRecord(recordInput) {
  if (recordInput === undefined) {
    return undefined;
  }

  if (recordInput === null || recordInput === '') {
    return null;
  }

  const parsed = typeof recordInput === 'string' ? JSON.parse(recordInput) : recordInput;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('打卡记录格式不正确');
  }

  const source = normalizeText(parsed.source);
  const emoji = normalizeText(parsed.emoji);
  const photo = normalizeText(parsed.photo || parsed.photoUrl || parsed.imageUrl);
  const thumbnailUrl = normalizeText(parsed.thumbnailUrl || parsed.thumbnail || parsed.thumbUrl);
  const notes = normalizeText(parsed.notes || parsed.note);
  const costValue = parsed.cost ?? parsed.price;
  const cost = costValue === undefined || costValue === null || costValue === ''
    ? null
    : Number(costValue);

  if (source && !MEAL_RECORD_SOURCES.has(source)) {
    throw new TypeError('就餐来源格式不正确');
  }

  if (emoji.length > 20) {
    throw new TypeError('心情表情太长了，不能超过 20 个字符');
  }

  if (photo.length > 255 || thumbnailUrl.length > 255) {
    throw new TypeError('打卡图片 URL 太长了，不能超过 255 个字符');
  }

  if (notes.length > MAX_RECORD_TEXT_LENGTH) {
    throw new TypeError(`打卡备注太长了，不能超过 ${MAX_RECORD_TEXT_LENGTH} 个字符`);
  }

  if (cost !== null && (!Number.isFinite(cost) || cost < 0 || cost > 999999.99)) {
    throw new TypeError('本餐花费格式不正确');
  }

  const tags = normalizeStringList(parsed.tags, '饮食标签');
  const record = {};

  if (source) record.source = source;
  if (emoji) record.emoji = emoji;
  if (photo) record.photo = photo;
  if (thumbnailUrl) record.thumbnailUrl = thumbnailUrl;
  if (cost !== null) record.cost = Math.round(cost * 100) / 100;
  if (tags.length) record.tags = tags;
  if (notes) record.notes = notes;

  return Object.keys(record).length ? record : null;
}

function stringifyRecord(record) {
  if (!record) {
    return null;
  }

  return JSON.stringify(record);
}

function parseRecord(row) {
  const record = parseJsonSafely(row.record_json, null);
  return record && typeof record === 'object' && !Array.isArray(record) ? record : null;
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
    const hasRecordInput = Object.prototype.hasOwnProperty.call(meal, 'record')
      || Object.prototype.hasOwnProperty.call(meal, 'recordJson')
      || Object.prototype.hasOwnProperty.call(meal, 'record_json');
    const recordInput = Object.prototype.hasOwnProperty.call(meal, 'record')
      ? meal.record
      : (Object.prototype.hasOwnProperty.call(meal, 'recordJson') ? meal.recordJson : meal.record_json);

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
      recipes: uniqueRecipeNames(recipesInput),
      record: hasRecordInput ? normalizeRecord(recordInput) : null
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
  const record = parseRecord(row);
  const meal = {
    mealName: row.meal_name,
    meal_name: row.meal_name,
    done: Number(row.done) ? 1 : 0,
    recipes
  };

  if (record) {
    meal.record = record;
  }

  return meal;
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
        record_json: row.record_json || null,
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
        grouped.get(row.meal_name).record_json = row.record_json || null;
      }
    });

    return toPlan(familyCode, date, Array.from(grouped.values()).map((row) => toMeal(row, row.recipes)));
  }

  await ensureMealRecordColumn();
  const planRows = await query(
    `SELECT ${PLAN_COLUMNS}
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
      grouped.get(row.meal_name).record_json = row.record_json || null;
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
        record_json: stringifyRecord(meal.record),
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

  await ensureMealRecordColumn();
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
           (family_code, plan_date, meal_name, done, record_json, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [familyCode, date, meal.mealName, meal.done, stringifyRecord(meal.record), memberCode, memberCode]
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

async function updateMealStatusByFamily(familyCode, memberCode, dateInput, mealNameInput, doneInput, recordInput = undefined) {
  const date = normalizeDate(dateInput);
  const mealName = getMealName(mealNameInput);
  const done = normalizeDone(doneInput, 0);
  const record = normalizeRecord(recordInput);
  const recordJson = stringifyRecord(record);
  const hasRecordInput = recordInput !== undefined;

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const key = planKey(familyCode, date, mealName);
    const current = mockPlans.get(key);
    mockPlans.set(key, {
      family_code: familyCode,
      plan_date: date,
      meal_name: mealName,
      done,
      record_json: hasRecordInput ? recordJson : current?.record_json || null,
      created_by: current?.created_by || memberCode,
      updated_by: memberCode,
      created_at: current?.created_at || now,
      updated_at: now
    });
    return listPlanByFamily(familyCode, date);
  }

  await ensureMealRecordColumn();
  if (hasRecordInput) {
    await query(
      `INSERT INTO ${PLAN_TABLE}
         (family_code, plan_date, meal_name, done, record_json, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         done = VALUES(done),
         record_json = VALUES(record_json),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [familyCode, date, mealName, done, recordJson, memberCode, memberCode]
    );
  } else {
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
  }

  return listPlanByFamily(familyCode, date);
}

async function updateMealStatusByDevice(deviceId, familyCode, date, mealName, done, record = undefined) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return {
    member,
    plan: await updateMealStatusByFamily(member.familyCode, member.memberCode, date, mealName, done, record)
  };
}

function normalizeDiaryRange(startDateInput, endDateInput) {
  const startDate = normalizeDate(startDateInput);
  const endDate = normalizeDate(endDateInput);

  if (startDate > endDate) {
    throw new TypeError('开始日期不能晚于结束日期');
  }

  const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000;
  if (days > 366) {
    throw new TypeError('饮食日记查询范围不能超过 366 天');
  }

  return { startDate, endDate };
}

function toDiary(familyCode, rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const date = row.plan_date instanceof Date
      ? row.plan_date.toISOString().slice(0, 10)
      : String(row.plan_date).slice(0, 10);
    if (!grouped.has(date)) {
      grouped.set(date, {
        familyCode,
        family_code: familyCode,
        date,
        meals: []
      });
    }

    grouped.get(date).meals.push(toMeal(row, row.recipes || []));
  });

  return Array.from(grouped.values());
}

async function listDiaryByFamily(familyCode, startDateInput, endDateInput) {
  const { startDate, endDate } = normalizeDiaryRange(startDateInput, endDateInput);

  if (env.useMockDb) {
    const planRows = Array.from(mockPlans.values())
      .filter((row) => (
        row.family_code === familyCode
        && row.plan_date >= startDate
        && row.plan_date <= endDate
        && (Number(row.done) || row.record_json)
      ))
      .sort((a, b) => String(b.plan_date).localeCompare(String(a.plan_date))
        || DEFAULT_MEAL_NAMES.indexOf(a.meal_name) - DEFAULT_MEAL_NAMES.indexOf(b.meal_name)
        || String(a.meal_name).localeCompare(String(b.meal_name)));

    const rows = planRows.map((row) => ({
      ...row,
      recipes: Array.from(mockPlanItems.values())
        .filter((item) => (
          item.family_code === familyCode
          && item.plan_date === row.plan_date
          && item.meal_name === row.meal_name
        ))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => item.recipe_name)
    }));

    return toDiary(familyCode, rows);
  }

  await ensureMealRecordColumn();
  const rows = await query(
    `SELECT p.plan_date,
            p.meal_name,
            p.done,
            p.record_json,
            GROUP_CONCAT(i.recipe_name ORDER BY i.sort_order ASC, i.id ASC SEPARATOR '\u001F') AS recipes_text
     FROM ${PLAN_TABLE} p
     LEFT JOIN ${PLAN_ITEM_TABLE} i
       ON i.family_code = p.family_code
      AND i.plan_date = p.plan_date
      AND i.meal_name = p.meal_name
     WHERE p.family_code = ?
       AND p.plan_date BETWEEN ? AND ?
       AND (p.done = 1 OR p.record_json IS NOT NULL)
     GROUP BY p.plan_date, p.meal_name, p.done, p.record_json
     ORDER BY p.plan_date DESC, FIELD(p.meal_name, '早餐', '午餐', '晚餐'), p.meal_name ASC`,
    [familyCode, startDate, endDate]
  );

  return toDiary(familyCode, rows.map((row) => ({
    ...row,
    recipes: row.recipes_text ? String(row.recipes_text).split('\u001F').filter(Boolean) : []
  })));
}

async function listDiaryByDevice(deviceId, familyCode, startDate, endDate) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return {
    member,
    diary: await listDiaryByFamily(member.familyCode, startDate, endDate)
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
  listDiaryByDevice,
  listCommonByDevice,
  addCommonByDevice,
  removeCommonByDevice,
  listTempByDevice,
  addTempByDevice,
  removeTempByDevice
};
