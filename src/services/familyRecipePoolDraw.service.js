const crypto = require('crypto');
const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');
const familyRecipePoolService = require('./familyRecipePool.service');
const familyDietPreferenceService = require('./familyDietPreference.service');
const familyMealService = require('./familyMeal.service');
const familyIngredientService = require('./familyIngredient.service');
const familyHealthService = require('./familyHealth.service');
const familyConsumptionService = require('./familyConsumption.service');
const familyShoppingCategoryService = require('./familyShoppingCategory.service');

const DRAW_EVENT_TABLE = 'family_recipe_pool_draw_events';
const DISH_TYPE_TAKEOUT = '外卖';
const DISH_TYPE_DINE_IN = '堂食';
const DISH_TYPE_COOK = '做饭';
const DISH_TYPES = new Set([DISH_TYPE_TAKEOUT, DISH_TYPE_DINE_IN, DISH_TYPE_COOK]);
const FEEDBACK_ACTIONS = new Set(['accept', 'skip', 'cooked', 'reject']);
const MAX_DRAW_COUNT = 3;
const SCORE_MIN = 0.05;
const SCORE_MAX = 8;
const MANUAL_WEIGHT_MIN = 0.2;
const MANUAL_WEIGHT_MAX = 3;
const EXPIRY_SOON_DAYS = 3;
const DRAW_STATS_LOOKBACK_DAYS = 7;
const DRAWN_PENDING_DAYS = 3;
const DINING_SPEND_LOOKBACK_DAYS = 7;
const DINING_SPEND_HIGH_THRESHOLD = 200;
const DINING_CATEGORY_KEYWORDS = ['餐饮', '外卖', '堂食', '饭店', '美食', '吃饭', '聚餐', 'takeout', '外卖食品'];
const LIGHT_FOOD_KEYWORDS = ['清淡', '沙拉', '凉菜', '凉拌', '汤', '羹', '粥', '蒸', '水煮', '轻食', '蔬菜'];
const HEAVY_FOOD_KEYWORDS = ['油炸', '炸', '红烧', '糖醋', '肥', '奶油', '烧烤', '火锅', '干锅', '麻辣', '酥'];
const PROTEIN_FOOD_KEYWORDS = ['鸡胸', '牛肉', '虾', '鱼', '蛋', '豆腐', '鸡', '排骨', '三文鱼', '蛋白'];
const HOT_WEATHER_UP_KEYWORDS = ['凉', '凉拌', '沙拉', '冷', '冰'];
const HOT_WEATHER_DOWN_KEYWORDS = ['红烧', '火锅', '炖', '炸', '干锅', '煲'];
const COLD_WEATHER_UP_KEYWORDS = ['汤', '羹', '火锅', '炖', '煲', '热'];
const COLD_WEATHER_DOWN_KEYWORDS = ['凉', '凉拌', '沙拉', '冷'];
const RAIN_WEATHER_UP_KEYWORDS = ['汤', '羹', '粥'];

const mockDrawEvents = [];

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createDrawId() {
  return `draw_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getBeijingParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  const hour = Number(parts.hour) % 24;
  const weekday = parts.weekday;
  const isWorkday = !['Sat', 'Sun'].includes(weekday);

  return {
    today: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    isWorkday
  };
}

function normalizeTypes(input) {
  if (input === undefined || input === null || input === '') {
    return [];
  }

  const list = Array.isArray(input) ? input : [input];
  const types = [];

  list.forEach((value) => {
    const type = normalizeText(value);
    if (!type) {
      return;
    }
    if (!DISH_TYPES.has(type)) {
      throw new TypeError('菜品类型只能是外卖、堂食、做饭');
    }
    if (!types.includes(type)) {
      types.push(type);
    }
  });

  return types;
}

function normalizeExcludeDishIds(input) {
  if (input === undefined || input === null || input === '') {
    return [];
  }

  const list = Array.isArray(input) ? input : [input];
  return Array.from(new Set(list.map((value) => normalizeText(value)).filter(Boolean)));
}

function normalizeCount(input) {
  if (input === undefined || input === null || input === '') {
    return 1;
  }

  const count = Number(input);
  if (!Number.isInteger(count) || count < 1) {
    throw new TypeError('抽签数量必须是正整数');
  }

  return Math.min(count, MAX_DRAW_COUNT);
}

function normalizeContext(input = {}, beijing) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const hour = raw.hour === undefined || raw.hour === null || raw.hour === ''
    ? beijing.hour
    : Number(raw.hour);

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    throw new TypeError('小时必须是 0-23 的数字');
  }

  const isWorkday = raw.isWorkday === undefined && raw.is_workday === undefined
    ? beijing.isWorkday
    : Boolean(raw.isWorkday ?? raw.is_workday);

  return {
    mealName: normalizeText(raw.mealName || raw.meal_name || ''),
    intent: normalizeText(raw.intent || 'normal') || 'normal',
    isWorkday,
    hour: Math.floor(hour),
    weather: normalizeText(raw.weather || 'normal') || 'normal',
    today: beijing.today
  };
}

function namesMatch(left, right) {
  const a = normalizeText(left).toLowerCase();
  const b = normalizeText(right).toLowerCase();
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function hitAvoid(dishName, ingredients, avoids) {
  const haystacks = [
    dishName,
    ...(Array.isArray(ingredients) ? ingredients.map((item) => item.name) : [])
  ];

  return avoids.some((avoid) => haystacks.some((text) => namesMatch(text, avoid)));
}

function typeBoost(type, context) {
  const lateWorkday = context.isWorkday && context.hour >= 20;
  const quick = context.intent === 'quick';
  const weekend = !context.isWorkday;

  if (lateWorkday || quick) {
    if (type === DISH_TYPE_COOK) return { key: '类型', value: 0.75 };
    if (type === DISH_TYPE_TAKEOUT) return { key: '类型', value: 1.45 };
    return { key: '类型', value: 1.0 };
  }

  if (context.isWorkday && context.hour >= 11 && context.hour <= 14) {
    if (type === DISH_TYPE_COOK) return { key: '类型', value: 1.0 };
    if (type === DISH_TYPE_TAKEOUT) return { key: '类型', value: 1.15 };
    return { key: '类型', value: 1.05 };
  }

  if (weekend) {
    if (type === DISH_TYPE_COOK) return { key: '类型', value: 1.25 };
    if (type === DISH_TYPE_TAKEOUT) return { key: '类型', value: 0.8 };
    return { key: '类型', value: 1.1 };
  }

  return { key: '类型', value: 1.0 };
}

function defaultBoost(isDefault) {
  return { key: '默认菜', value: isDefault ? 0.85 : 1.0 };
}

function manualBoost(manualWeight) {
  const weight = Number(manualWeight);
  const value = Number.isFinite(weight)
    ? clamp(weight, MANUAL_WEIGHT_MIN, MANUAL_WEIGHT_MAX)
    : 1;
  return { key: '手动', value };
}

function freshBoost(createdAt, today) {
  if (!createdAt) {
    return { key: '新鲜', value: 1.0 };
  }

  const created = createdAt instanceof Date
    ? createdAt.toISOString().slice(0, 10)
    : String(createdAt).slice(0, 10);
  const start = new Date(`${created}T00:00:00.000Z`);
  const end = new Date(`${today}T00:00:00.000Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);

  if (!Number.isFinite(days) || days < 0) {
    return { key: '新鲜', value: 1.0 };
  }
  if (days <= 3) {
    return { key: '新鲜', value: 1.25 };
  }
  if (days <= 7) {
    return { key: '新鲜', value: 1.1 };
  }
  return { key: '新鲜', value: 1.0 };
}

function recencyEatBoost(daysSinceEaten) {
  if (daysSinceEaten === undefined || daysSinceEaten === null) {
    return { key: '最近吃过', value: 1.05 };
  }

  const days = Number(daysSinceEaten);
  if (!Number.isFinite(days)) {
    return { key: '最近吃过', value: 1.05 };
  }
  if (days <= 1) return { key: '最近吃过', value: 0.25 };
  if (days <= 3) return { key: '最近吃过', value: 0.55 };
  if (days <= 7) return { key: '最近吃过', value: 0.75 };
  if (days <= 14) return { key: '最近吃过', value: 0.9 };
  return { key: '最近吃过', value: 1.05 };
}

function recencyDrawBoost(stats) {
  const skips = Number(stats?.skips) || 0;
  if (skips >= 3) return { key: '抽签反馈', value: 0.5 };
  if (skips === 2) return { key: '抽签反馈', value: 0.7 };
  if (skips === 1) return { key: '抽签反馈', value: 0.85 };
  if (stats?.drawnPending) return { key: '抽签反馈', value: 0.8 };
  return { key: '抽签反馈', value: 1.0 };
}

function tasteBoost(dishName, recipe, tastes) {
  if (!Array.isArray(tastes) || !tastes.length) {
    return { key: '口味', value: 1.0 };
  }

  const haystacks = [
    dishName,
    recipe?.category,
    ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((item) => item.name) : [])
  ];

  const matched = tastes.some((taste) => haystacks.some((text) => namesMatch(text, taste)));
  return { key: '口味', value: matched ? 1.15 : 1.0 };
}

function buildFoodText(dishName, recipe) {
  return [
    dishName,
    recipe?.category,
    recipe?.name,
    ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((item) => item.name) : [])
  ]
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function includesAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
}

function healthBoost(dishName, recipe, goalType) {
  if (!normalizeText(goalType)) {
    return { key: '健康', value: 1.0 };
  }

  const goalKey = familyHealthService.normalizeGoalKey(goalType);
  const text = buildFoodText(dishName, recipe);
  if (!text) {
    return { key: '健康', value: 1.0 };
  }

  if (goalKey === 'fat_loss') {
    if (includesAnyKeyword(text, HEAVY_FOOD_KEYWORDS)) {
      return { key: '健康', value: 0.75 };
    }
    if (includesAnyKeyword(text, LIGHT_FOOD_KEYWORDS)) {
      return { key: '健康', value: 1.2 };
    }
  }

  if (goalKey === 'muscle_gain' && includesAnyKeyword(text, PROTEIN_FOOD_KEYWORDS)) {
    return { key: '健康', value: 1.15 };
  }

  return { key: '健康', value: 1.0 };
}

function intentBoost(intent, healthFactorValue) {
  if (intent !== 'healthy' || healthFactorValue === 1) {
    return { key: '意图', value: 1.0 };
  }

  if (healthFactorValue > 1) {
    return { key: '意图', value: 1.1 };
  }

  if (healthFactorValue < 1) {
    return { key: '意图', value: 0.95 };
  }

  return { key: '意图', value: 1.0 };
}

function weatherBoost(dishName, recipe, weather) {
  const normalizedWeather = normalizeText(weather).toLowerCase();
  if (!normalizedWeather || normalizedWeather === 'normal') {
    return { key: '天气', value: 1.0 };
  }

  const text = buildFoodText(dishName, recipe);
  if (!text) {
    return { key: '天气', value: 1.0 };
  }

  if (normalizedWeather === 'hot') {
    if (includesAnyKeyword(text, HOT_WEATHER_UP_KEYWORDS)) {
      return { key: '天气', value: 1.2 };
    }
    if (includesAnyKeyword(text, HOT_WEATHER_DOWN_KEYWORDS)) {
      return { key: '天气', value: 0.85 };
    }
  }

  if (normalizedWeather === 'cold') {
    if (includesAnyKeyword(text, COLD_WEATHER_UP_KEYWORDS)) {
      return { key: '天气', value: 1.2 };
    }
    if (includesAnyKeyword(text, COLD_WEATHER_DOWN_KEYWORDS)) {
      return { key: '天气', value: 0.85 };
    }
  }

  if (normalizedWeather === 'rain' && includesAnyKeyword(text, RAIN_WEATHER_UP_KEYWORDS)) {
    return { key: '天气', value: 1.15 };
  }

  return { key: '天气', value: 1.0 };
}

function consumptionTypeBoost(type, diningSpendHigh) {
  if (!diningSpendHigh) {
    return { key: '消费', value: 1.0 };
  }

  if (type === DISH_TYPE_COOK) return { key: '消费', value: 1.2 };
  if (type === DISH_TYPE_TAKEOUT) return { key: '消费', value: 0.7 };
  if (type === DISH_TYPE_DINE_IN) return { key: '消费', value: 0.9 };
  return { key: '消费', value: 1.0 };
}

function addDaysToDateText(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toEventDateText(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value || '').slice(0, 10);
}

function isDiningCategoryOrName(text, categoryName) {
  const haystack = `${normalizeText(text)} ${normalizeText(categoryName)}`.toLowerCase();
  return DINING_CATEGORY_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function favoriteBoost(recipe) {
  return { key: '收藏', value: recipe?.favorite ? 1.35 : 1.0 };
}

function commonBoost(dishName, mealName, commonMenus) {
  const menus = commonMenus && typeof commonMenus === 'object' ? commonMenus : {};
  const currentMeal = normalizeText(mealName);
  const inCurrentMeal = currentMeal
    && Array.isArray(menus[currentMeal])
    && menus[currentMeal].some((name) => normalizeText(name) === dishName);

  if (inCurrentMeal) {
    return { key: '常用', value: 1.2 };
  }

  const inAnyMeal = Object.values(menus).some((list) => (
    Array.isArray(list) && list.some((name) => normalizeText(name) === dishName)
  ));

  if (inAnyMeal) {
    return { key: '常用', value: 1.05 };
  }

  return { key: '常用', value: 1.0 };
}

function parseDurationMinutes(duration) {
  const text = normalizeText(duration).toLowerCase();
  if (!text) {
    return null;
  }

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(小时|hour|hr|h)/);
  const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(分钟|分|min|m)?/);

  let minutes = 0;
  if (hourMatch) {
    minutes += Number(hourMatch[1]) * 60;
  }

  if (minuteMatch && (!hourMatch || minuteMatch.index !== hourMatch.index)) {
    const onlyNumber = /^(\d+(?:\.\d+)?)$/.test(text);
    if (minuteMatch[2] || onlyNumber || /分钟|分|min/.test(text)) {
      minutes += Number(minuteMatch[1]);
    }
  }

  if (!minutes && hourMatch) {
    return Number(hourMatch[1]) * 60;
  }

  return minutes > 0 ? minutes : null;
}

function getDifficultyBucket(recipe) {
  const difficulty = normalizeText(recipe?.difficulty).toLowerCase();
  const minutes = parseDurationMinutes(recipe?.duration);

  if (['简单', '容易', '易', 'easy', '简单易做'].some((token) => difficulty.includes(token))) {
    return 'easy';
  }
  if (['难', '复杂', '高级', 'hard', '困难'].some((token) => difficulty.includes(token))) {
    return 'hard';
  }
  if (['中', '一般', 'medium', 'normal'].some((token) => difficulty.includes(token))) {
    return 'medium';
  }

  if (minutes !== null) {
    if (minutes <= 20) return 'easy';
    if (minutes <= 45) return 'medium';
    return 'hard';
  }

  return 'medium';
}

function difficultyTimeBoost(recipe, context) {
  if (!recipe) {
    return { key: '难度耗时', value: 1.0 };
  }

  const bucket = getDifficultyBucket(recipe);
  const quickOrLate = context.intent === 'quick' || (context.isWorkday && context.hour >= 19);
  const weekendDay = !context.isWorkday && context.hour >= 10 && context.hour <= 18;

  if (quickOrLate) {
    if (bucket === 'easy') return { key: '难度耗时', value: 1.3 };
    if (bucket === 'medium') return { key: '难度耗时', value: 0.85 };
    return { key: '难度耗时', value: 0.55 };
  }

  if (weekendDay) {
    if (bucket === 'easy') return { key: '难度耗时', value: 0.95 };
    if (bucket === 'medium') return { key: '难度耗时', value: 1.1 };
    return { key: '难度耗时', value: 1.25 };
  }

  if (bucket === 'easy') return { key: '难度耗时', value: 1.05 };
  if (bucket === 'medium') return { key: '难度耗时', value: 1.0 };
  return { key: '难度耗时', value: 0.9 };
}

function getMainIngredients(recipe) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return ingredients.filter((item) => item && item.name && !item.isSeasoning);
}

function toDateText(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function buildInventoryIndex(items, today) {
  const map = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || item.hasStock === false || item.has === false) {
      return;
    }

    const name = normalizeText(item.name);
    if (!name) {
      return;
    }

    const expireDate = toDateText(item.expireDate || item.expire_date);
    if (expireDate && expireDate < today) {
      return;
    }

    const key = name.toLowerCase();
    const current = map.get(key);
    if (!current || (expireDate && (!current.expireDate || expireDate < current.expireDate))) {
      map.set(key, { name, expireDate });
    }
  });

  return map;
}

function findInventoryMatch(ingredientName, inventory) {
  const target = normalizeText(ingredientName).toLowerCase();
  if (!target) {
    return null;
  }

  if (inventory.has(target)) {
    return inventory.get(target);
  }

  for (const [key, value] of inventory.entries()) {
    if (key.includes(target) || target.includes(key)) {
      return value;
    }
  }

  return null;
}

function inventoryBoost(recipe, inventory) {
  const mains = getMainIngredients(recipe);
  if (!mains.length || !inventory.size) {
    return { key: '库存', value: 1.0 };
  }

  const hitCount = mains.filter((item) => findInventoryMatch(item.name, inventory)).length;
  const hitRate = hitCount / mains.length;

  if (hitRate >= 0.8) return { key: '库存', value: 1.35 };
  if (hitRate >= 0.5) return { key: '库存', value: 1.15 };
  if (hitRate >= 0.3) return { key: '库存', value: 1.0 };
  return { key: '库存', value: 0.7 };
}

function expiryBoost(recipe, inventory, today, intent) {
  const mains = getMainIngredients(recipe);
  if (!mains.length || !inventory.size) {
    return { key: '临期', value: 1.0 };
  }

  const limit = new Date(`${today}T00:00:00.000Z`);
  limit.setUTCDate(limit.getUTCDate() + EXPIRY_SOON_DAYS);
  const limitText = limit.toISOString().slice(0, 10);

  const hasExpiring = mains.some((item) => {
    const matched = findInventoryMatch(item.name, inventory);
    return matched?.expireDate && matched.expireDate >= today && matched.expireDate <= limitText;
  });

  if (!hasExpiring) {
    return { key: '临期', value: 1.0 };
  }

  const value = intent === 'clear_fridge' ? 1.8 : 1.5;
  return { key: '临期', value };
}

function collectIngredientHints(recipe, inventory, today) {
  const mains = getMainIngredients(recipe);
  const missingIngredients = [];
  const expiringIngredients = [];

  if (!mains.length) {
    return { missingIngredients, expiringIngredients };
  }

  const limit = new Date(`${today}T00:00:00.000Z`);
  limit.setUTCDate(limit.getUTCDate() + EXPIRY_SOON_DAYS);
  const limitText = limit.toISOString().slice(0, 10);

  mains.forEach((item) => {
    const matched = findInventoryMatch(item.name, inventory);
    if (!matched) {
      missingIngredients.push(item.name);
      return;
    }
    if (matched.expireDate && matched.expireDate >= today && matched.expireDate <= limitText) {
      expiringIngredients.push(item.name);
    }
  });

  return { missingIngredients, expiringIngredients };
}

function indexRecipes(familyRecipe) {
  const byId = new Map();
  const byName = new Map();
  const recipes = familyRecipe?.recipes || [];

  recipes.forEach((recipe) => {
    const id = normalizeText(recipe.recipeId || recipe.id);
    const name = normalizeText(recipe.name);
    if (id) {
      byId.set(id, recipe);
    }
    if (name && !byName.has(name)) {
      byName.set(name, recipe);
    }
  });

  return { byId, byName };
}

function resolveRecipe(dish, recipeIndex) {
  const recipeId = normalizeText(dish.recipeId);
  if (recipeId && recipeIndex.byId.has(recipeId)) {
    const matched = recipeIndex.byId.get(recipeId);
    if (matched.source !== 'public') {
      return matched;
    }
  }

  const name = normalizeText(dish.name);
  if (name && recipeIndex.byName.has(name)) {
    const matched = recipeIndex.byName.get(name);
    if (matched.source !== 'public') {
      return matched;
    }
  }

  if (dish.recipe) {
    return dish.recipe;
  }

  if (recipeId && recipeIndex.byId.has(recipeId)) {
    return recipeIndex.byId.get(recipeId);
  }

  if (name && recipeIndex.byName.has(name)) {
    return recipeIndex.byName.get(name);
  }

  return null;
}

function collectTodayRecipeNames(plan) {
  const names = new Set();
  const meals = Array.isArray(plan?.meals) ? plan.meals : [];

  meals.forEach((meal) => {
    const recipes = Array.isArray(meal.recipes) ? meal.recipes : [];
    recipes.forEach((name) => {
      const text = normalizeText(name);
      if (text) {
        names.add(text);
      }
    });
  });

  return names;
}

function weightedSampleWithoutReplacement(items, count) {
  const pool = items.slice();
  const picked = [];

  for (let i = 0; i < count && pool.length; i += 1) {
    const total = pool.reduce((sum, item) => sum + item.score, 0);
    let cursor = Math.random() * total;
    let index = pool.length - 1;

    for (let j = 0; j < pool.length; j += 1) {
      cursor -= pool[j].score;
      if (cursor <= 0) {
        index = j;
        break;
      }
    }

    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

async function listDrawEventsByFamily(familyCode, startDate) {
  if (env.useMockDb) {
    return mockDrawEvents
      .filter((row) => (
        row.family_code === familyCode
        && toEventDateText(row.created_at) >= startDate
      ))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  return query(
    `SELECT draw_id, family_code, dish_id, dish_name, meal_name, action, score, created_at
     FROM ${DRAW_EVENT_TABLE}
     WHERE family_code = ?
       AND created_at >= ?
     ORDER BY created_at ASC, id ASC`,
    [`${familyCode}`, `${startDate} 00:00:00`]
  );
}

async function getRecentDrawStatsByFamily(familyCode, today) {
  const startDate = addDaysToDateText(today, -DRAW_STATS_LOOKBACK_DAYS);
  const pendingStart = addDaysToDateText(today, -DRAWN_PENDING_DAYS);
  const events = await listDrawEventsByFamily(familyCode, startDate);
  const stats = new Map();

  function ensureStat(dishId) {
    if (!stats.has(dishId)) {
      stats.set(dishId, { skips: 0, drawnPending: false });
    }
    return stats.get(dishId);
  }

  events.forEach((row) => {
    const dishId = normalizeText(row.dish_id);
    const action = normalizeText(row.action);
    if (!dishId) {
      return;
    }

    const current = ensureStat(dishId);
    if (action === 'skip' || action === 'reject') {
      current.skips += 1;
    }
  });

  const positiveKeys = new Set(
    events
      .filter((row) => ['accept', 'cooked'].includes(normalizeText(row.action)))
      .map((row) => `${normalizeText(row.draw_id)}:${normalizeText(row.dish_id)}`)
  );

  events.forEach((row) => {
    if (normalizeText(row.action) !== 'drawn') {
      return;
    }

    const eventDate = toEventDateText(row.created_at);
    if (eventDate < pendingStart) {
      return;
    }

    const dishId = normalizeText(row.dish_id);
    const key = `${normalizeText(row.draw_id)}:${dishId}`;
    if (!positiveKeys.has(key)) {
      ensureStat(dishId).drawnPending = true;
    }
  });

  return stats;
}

async function isDiningSpendHigh(familyCode, today) {
  const startDate = addDaysToDateText(today, -DINING_SPEND_LOOKBACK_DAYS);
  const [records, categories] = await Promise.all([
    familyConsumptionService.listRecordsByFamily(familyCode, {
      startTime: startDate,
      endTime: today
    }),
    familyShoppingCategoryService.listCategoriesByFamily(familyCode)
  ]);

  const categoryNames = new Map(
    (categories || []).map((category) => [category.categoryId || category.id, category.name])
  );

  const total = (records || []).reduce((sum, record) => {
    const categoryName = categoryNames.get(record.categoryId || record.category_id) || '';
    if (!isDiningCategoryOrName(record.name, categoryName)) {
      return sum;
    }
    const price = Number(record.price);
    return sum + (Number.isFinite(price) ? price : 0);
  }, 0);

  return total >= DINING_SPEND_HIGH_THRESHOLD;
}

async function resolveGoalType(familyCode, memberCode, preferredMemberId) {
  const profiles = await familyHealthService.listProfilesByFamily(familyCode);
  if (!profiles.length) {
    return null;
  }

  const preferred = normalizeText(preferredMemberId);
  if (preferred) {
    const matched = profiles.find((row) => normalizeText(row.member_code) === preferred);
    if (matched?.goal_type) {
      return matched.goal_type;
    }
  }

  const self = profiles.find((row) => normalizeText(row.member_code) === normalizeText(memberCode));
  if (self?.goal_type) {
    return self.goal_type;
  }

  const firstWithGoal = profiles.find((row) => normalizeText(row.goal_type));
  return firstWithGoal?.goal_type || null;
}

async function findDrawnEvent(familyCode, drawId, dishId) {
  if (env.useMockDb) {
    const rows = mockDrawEvents
      .filter((row) => (
        row.family_code === familyCode
        && row.draw_id === drawId
        && row.dish_id === dishId
        && row.action === 'drawn'
      ))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return rows[0] || null;
  }

  const rows = await query(
    `SELECT draw_id, family_code, dish_id, dish_name, meal_name, action, score, context_json, created_by, created_at
     FROM ${DRAW_EVENT_TABLE}
     WHERE family_code = ? AND draw_id = ? AND dish_id = ? AND action = 'drawn'
     ORDER BY id DESC
     LIMIT 1`,
    [familyCode, drawId, dishId]
  );

  return rows[0] || null;
}

async function saveFeedbackEvent(familyCode, memberCode, drawnEvent, action) {
  const contextJson = drawnEvent.context_json
    ? (typeof drawnEvent.context_json === 'string'
      ? drawnEvent.context_json
      : JSON.stringify(drawnEvent.context_json))
    : null;

  if (env.useMockDb) {
    const row = {
      id: mockDrawEvents.length + 1,
      draw_id: drawnEvent.draw_id,
      family_code: familyCode,
      dish_id: drawnEvent.dish_id,
      dish_name: drawnEvent.dish_name,
      meal_name: drawnEvent.meal_name || null,
      action,
      score: drawnEvent.score,
      context_json: contextJson,
      created_by: memberCode,
      created_at: new Date().toISOString()
    };
    mockDrawEvents.push(row);
    return row;
  }

  await query(
    `INSERT INTO ${DRAW_EVENT_TABLE}
       (draw_id, family_code, dish_id, dish_name, meal_name, action, score, context_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      drawnEvent.draw_id,
      familyCode,
      drawnEvent.dish_id,
      drawnEvent.dish_name,
      drawnEvent.meal_name || null,
      action,
      drawnEvent.score,
      contextJson,
      memberCode
    ]
  );

  return {
    draw_id: drawnEvent.draw_id,
    dish_id: drawnEvent.dish_id,
    dish_name: drawnEvent.dish_name,
    action,
    score: drawnEvent.score
  };
}

async function saveDrawEvents(drawId, familyCode, memberCode, mealName, context, picked) {
  const contextJson = JSON.stringify({
    mealName: context.mealName,
    intent: context.intent,
    isWorkday: context.isWorkday,
    hour: context.hour,
    weather: context.weather,
    today: context.today
  });

  if (env.useMockDb) {
    picked.forEach((item) => {
      mockDrawEvents.push({
        id: mockDrawEvents.length + 1,
        draw_id: drawId,
        family_code: familyCode,
        dish_id: item.dish.dishId || item.dish.id,
        dish_name: item.dish.name,
        meal_name: mealName || null,
        action: 'drawn',
        score: item.score,
        context_json: contextJson,
        created_by: memberCode,
        created_at: new Date().toISOString()
      });
    });
    return;
  }

  for (const item of picked) {
    await query(
      `INSERT INTO ${DRAW_EVENT_TABLE}
         (draw_id, family_code, dish_id, dish_name, meal_name, action, score, context_json, created_by)
       VALUES (?, ?, ?, ?, ?, 'drawn', ?, ?, ?)`,
      [
        drawId,
        familyCode,
        item.dish.dishId || item.dish.id,
        item.dish.name,
        mealName || null,
        item.score,
        contextJson,
        memberCode
      ]
    );
  }
}

function formatDrawItem(item) {
  return {
    dishId: item.dish.dishId || item.dish.id,
    id: item.dish.dishId || item.dish.id,
    name: item.dish.name,
    type: item.dish.type,
    recipeId: item.recipe?.recipeId || item.recipe?.id || item.dish.recipeId || null,
    score: Number(item.score.toFixed(4)),
    reasons: item.reasons,
    missingIngredients: item.missingIngredients || [],
    expiringIngredients: item.expiringIngredients || []
  };
}

async function drawByFamily(familyCode, memberCode, input = {}) {
  const beijing = getBeijingParts();
  const types = normalizeTypes(input.types);
  const excludeDishIds = normalizeExcludeDishIds(
    input.excludeDishIds || input.exclude_dish_ids || input.excludeIds
  );
  const count = normalizeCount(input.count);
  const context = normalizeContext({
    ...(input.context && typeof input.context === 'object' ? input.context : {}),
    mealName: input.mealName || input.meal_name || input.context?.mealName,
    intent: input.intent || input.context?.intent
  }, beijing);
  const preferredMemberId = normalizeText(input.memberId || input.member_id || input.memberCode);

  const [
    dishes,
    avoidPreferences,
    tastePreferences,
    todayPlan,
    recentDays,
    familyRecipe,
    commonMenus,
    ingredientItems,
    drawStats,
    diningSpendHigh,
    goalType
  ] = await Promise.all([
    familyRecipePoolService.listDishesByFamily(familyCode),
    familyDietPreferenceService.listPreferencesByFamily(familyCode, { preferenceType: 'avoid_food' }),
    familyDietPreferenceService.listPreferencesByFamily(familyCode, { preferenceType: 'family_taste' }),
    familyMealService.listPlanByFamily(familyCode, context.today),
    familyMealService.getRecentRecipeDaysByFamily(familyCode, {
      lookbackDays: 30,
      today: context.today
    }),
    familyRecipeService.getFamilyRecipeByCode(familyCode),
    familyMealService.listCommonByFamily(familyCode),
    familyIngredientService.listItemsByFamily(familyCode),
    getRecentDrawStatsByFamily(familyCode, context.today),
    isDiningSpendHigh(familyCode, context.today),
    resolveGoalType(familyCode, memberCode, preferredMemberId)
  ]);

  const avoids = avoidPreferences.map((item) => item.title);
  const tastes = tastePreferences.map((item) => item.title);
  const todayNames = collectTodayRecipeNames(todayPlan);
  const recipeIndex = indexRecipes(familyRecipe);
  const inventory = buildInventoryIndex(ingredientItems, context.today);
  const candidates = [];

  dishes.forEach((dish) => {
    const dishId = dish.dishId || dish.id;
    const dishName = normalizeText(dish.name);

    if (!dishId || !dishName) {
      return;
    }
    if (dish.paused) {
      return;
    }
    if (types.length && !types.includes(dish.type)) {
      return;
    }
    if (excludeDishIds.includes(dishId)) {
      return;
    }
    if (todayNames.has(dishName)) {
      return;
    }

    const recipe = resolveRecipe(dish, recipeIndex);
    if (hitAvoid(dishName, recipe?.ingredients, avoids)) {
      return;
    }

    const factors = [];
    let score = 1;

    const apply = (factor) => {
      score *= factor.value;
      if (factor.value !== 1) {
        factors.push(`${factor.key}×${factor.value}`);
      }
    };

    apply(manualBoost(dish.manualWeight));
    apply(defaultBoost(Boolean(dish.isDefault)));
    apply(freshBoost(dish.createdAt, context.today));
    apply(typeBoost(dish.type, context));
    apply(consumptionTypeBoost(dish.type, diningSpendHigh));
    apply(recencyEatBoost(recentDays.get(dishName)));
    apply(recencyDrawBoost(drawStats.get(dishId)));
    apply(favoriteBoost(recipe));
    apply(commonBoost(dishName, context.mealName, commonMenus));
    apply(difficultyTimeBoost(recipe, context));
    apply(tasteBoost(dishName, recipe, tastes));

    const healthFactor = healthBoost(dishName, recipe, goalType);
    apply(healthFactor);
    apply(intentBoost(context.intent, healthFactor.value));
    apply(weatherBoost(dishName, recipe, context.weather));

    let missingIngredients = [];
    let expiringIngredients = [];

    if (dish.type === DISH_TYPE_COOK && recipe) {
      apply(inventoryBoost(recipe, inventory));
      apply(expiryBoost(recipe, inventory, context.today, context.intent));
      const hints = collectIngredientHints(recipe, inventory, context.today);
      missingIngredients = hints.missingIngredients;
      expiringIngredients = hints.expiringIngredients;
    }

    score = clamp(score, SCORE_MIN, SCORE_MAX);
    candidates.push({
      dish,
      recipe,
      score,
      reasons: factors,
      missingIngredients,
      expiringIngredients
    });
  });

  const drawId = createDrawId();

  if (!candidates.length) {
    return {
      drawId,
      items: [],
      context: {
        mealName: context.mealName || null,
        intent: context.intent,
        isWorkday: context.isWorkday,
        hour: context.hour,
        weather: context.weather,
        today: context.today,
        diningSpendHigh,
        goalType: goalType || null,
        candidateCount: 0
      }
    };
  }

  const picked = weightedSampleWithoutReplacement(candidates, count);
  await saveDrawEvents(drawId, familyCode, memberCode, context.mealName, context, picked);

  return {
    drawId,
    items: picked.map(formatDrawItem),
    context: {
      mealName: context.mealName || null,
      intent: context.intent,
      isWorkday: context.isWorkday,
      hour: context.hour,
      weather: context.weather,
      today: context.today,
      diningSpendHigh,
      goalType: goalType || null,
      candidateCount: candidates.length
    }
  };
}

async function drawByDevice(deviceId, familyCode, input = {}) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const result = await drawByFamily(member.familyCode, member.memberCode, input);
  return {
    member,
    ...result
  };
}

async function feedbackByFamily(familyCode, memberCode, input = {}) {
  const drawId = normalizeText(input.drawId || input.draw_id);
  const dishId = normalizeText(input.dishId || input.id || input._id || input.dish_id);
  const action = normalizeText(input.action).toLowerCase();

  if (!drawId) {
    throw new TypeError('请填写抽签 ID');
  }
  if (!dishId) {
    throw new TypeError('请填写菜品 ID');
  }
  if (!FEEDBACK_ACTIONS.has(action)) {
    throw new TypeError('反馈动作只能是 accept、skip、cooked、reject');
  }

  const drawnEvent = await findDrawnEvent(familyCode, drawId, dishId);
  if (!drawnEvent) {
    throw createNotFoundError('抽签记录不存在');
  }

  const saved = await saveFeedbackEvent(familyCode, memberCode, drawnEvent, action);

  return {
    drawId: saved.draw_id || drawId,
    dishId: saved.dish_id || dishId,
    dishName: saved.dish_name || drawnEvent.dish_name,
    action,
    score: saved.score === null || saved.score === undefined ? null : Number(saved.score)
  };
}

async function feedbackByDevice(deviceId, familyCode, input = {}) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const feedback = await feedbackByFamily(member.familyCode, member.memberCode, input);
  return {
    member,
    feedback
  };
}

module.exports = {
  drawByDevice,
  feedbackByDevice,
  _internals: {
    typeBoost,
    recencyEatBoost,
    recencyDrawBoost,
    freshBoost,
    defaultBoost,
    manualBoost,
    favoriteBoost,
    commonBoost,
    difficultyTimeBoost,
    inventoryBoost,
    expiryBoost,
    tasteBoost,
    healthBoost,
    intentBoost,
    weatherBoost,
    consumptionTypeBoost,
    parseDurationMinutes,
    getDifficultyBucket,
    weightedSampleWithoutReplacement,
    hitAvoid,
    clamp,
    mockDrawEvents
  }
};
