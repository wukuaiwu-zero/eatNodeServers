const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '../../data/public-recipes.json');
const DISH_TYPES = new Set(['外卖', '堂食', '做饭']);

let cached = null;

function createCatalogError(message) {
  const error = new Error(message);
  error.code = 'PUBLIC_RECIPE_CATALOG';
  error.statusCode = 500;
  return error;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeIngredient(ingredient, index) {
  if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) {
    return null;
  }

  const name = normalizeText(ingredient.name);
  if (!name) {
    return null;
  }

  return {
    name,
    amount: normalizeText(ingredient.amount),
    isSeasoning: Boolean(ingredient.isSeasoning),
    sortOrder: Number.isInteger(ingredient.sortOrder) ? ingredient.sortOrder : index
  };
}

function normalizeRecipe(recipe, index) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
    throw createCatalogError(`公共菜谱第 ${index + 1} 项格式不正确`);
  }

  const name = normalizeText(recipe.name);
  const id = normalizeText(recipe.id || recipe.recipeId || recipe.dishId) || `public_recipe_${index + 1}`;
  const type = normalizeText(recipe.type) || '做饭';

  if (!name) {
    throw createCatalogError(`公共菜谱第 ${index + 1} 项缺少名称`);
  }

  if (!DISH_TYPES.has(type)) {
    throw createCatalogError(`公共菜谱「${name}」的类型只能是外卖、堂食、做饭`);
  }

  const steps = Array.isArray(recipe.steps)
    ? recipe.steps.map((step) => normalizeText(step)).filter(Boolean)
    : [];

  return {
    id,
    name,
    type,
    category: normalizeText(recipe.category),
    cover: normalizeText(recipe.cover || recipe.coverUrl),
    difficulty: normalizeText(recipe.difficulty),
    duration: normalizeText(recipe.duration),
    favorite: Boolean(recipe.favorite),
    own: recipe.own !== false,
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map(normalizeIngredient).filter(Boolean)
      : [],
    steps
  };
}

function normalizeCatalog(raw) {
  const list = Array.isArray(raw)
    ? raw
    : (raw?.recipes || raw?.dishes);

  if (!Array.isArray(list)) {
    throw createCatalogError('公共菜谱文件格式不正确');
  }

  const recipes = list.map(normalizeRecipe);
  const ids = new Set();
  const names = new Set();

  recipes.forEach((recipe) => {
    if (ids.has(recipe.id)) {
      throw createCatalogError(`公共菜谱 id 重复：${recipe.id}`);
    }
    if (names.has(recipe.name)) {
      throw createCatalogError(`公共菜谱名称重复：${recipe.name}`);
    }
    ids.add(recipe.id);
    names.add(recipe.name);
  });

  return {
    version: Number(raw?.version) || 1,
    recipes
  };
}

function loadCatalog() {
  let stat;
  try {
    stat = fs.statSync(CATALOG_PATH);
  } catch (error) {
    throw createCatalogError('公共菜谱文件不存在');
  }

  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.catalog;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (error) {
    throw createCatalogError('公共菜谱文件不是合法 JSON');
  }

  const catalog = normalizeCatalog(raw);
  cached = { mtimeMs: stat.mtimeMs, catalog };
  return catalog;
}

function listRecipes() {
  return loadCatalog().recipes;
}

function getVersion() {
  return loadCatalog().version;
}

function getRecipe(recipeId) {
  const id = normalizeText(recipeId);
  return listRecipes().find((recipe) => recipe.id === id) || null;
}

function findByName(name) {
  const target = normalizeText(name);
  return listRecipes().find((recipe) => recipe.name === target) || null;
}

function toRecipeItem(recipe, familyCode = null) {
  return {
    id: recipe.id,
    recipeId: recipe.id,
    familyCode,
    name: recipe.name,
    category: recipe.category,
    cover: recipe.cover,
    coverUrl: recipe.cover,
    difficulty: recipe.difficulty,
    duration: recipe.duration,
    favorite: recipe.favorite,
    own: recipe.own,
    source: 'public',
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    version: 1,
    deleted: false,
    deletedAt: null,
    createdAt: null,
    updatedAt: null
  };
}

function mergeRecipes(familyRecipes, hiddenIds, familyCode) {
  const hidden = new Set(hiddenIds || []);
  const own = Array.isArray(familyRecipes) ? familyRecipes : [];
  const ownIds = new Set(own.map((recipe) => recipe.recipeId || recipe.id));
  const ownNames = new Set(own.map((recipe) => normalizeText(recipe.name)).filter(Boolean));
  const extras = listRecipes()
    .filter((recipe) => !hidden.has(recipe.id) && !ownIds.has(recipe.id) && !ownNames.has(recipe.name))
    .map((recipe) => toRecipeItem(recipe, familyCode));

  return [...own, ...extras];
}

function toPoolDish(recipe, override, familyCode) {
  return {
    id: recipe.id,
    _id: recipe.id,
    dishId: recipe.id,
    familyCode: override?.familyCode || familyCode || null,
    name: recipe.name,
    recipeId: recipe.id,
    type: override?.type || recipe.type,
    manualWeight: override?.manualWeight ?? 1,
    paused: Boolean(override?.paused),
    isDefault: true,
    source: 'public',
    version: override?.version || 1,
    deleted: Boolean(override?.deleted),
    deletedAt: override?.deletedAt || null,
    createdAt: override?.createdAt || null,
    updatedAt: override?.updatedAt || null,
    recipe: toRecipeItem(recipe, override?.familyCode || familyCode || null)
  };
}

function mergePoolDishes(familyDishes, options = {}) {
  const includeDeleted = Boolean(options.includeDeleted);
  const familyCode = options.familyCode || null;
  const ownNames = options.ownNames instanceof Set
    ? options.ownNames
    : new Set(options.ownNames || []);
  const records = Array.isArray(familyDishes) ? familyDishes : [];
  const byId = new Map(records.map((dish) => [dish.dishId || dish.id, dish]));
  const publicIds = new Set(listRecipes().map((recipe) => recipe.id));
  const merged = [];

  listRecipes().forEach((recipe) => {
    const override = byId.get(recipe.id);
    if (override?.deleted && !includeDeleted) {
      return;
    }
    if (!override?.deleted && ownNames.has(recipe.name)) {
      return;
    }
    merged.push(toPoolDish(recipe, override, familyCode));
  });

  records.forEach((dish) => {
    const dishId = dish.dishId || dish.id;
    if (!dishId || String(dishId).startsWith('default_dish_') || publicIds.has(dishId)) {
      return;
    }
    if (dish.deleted && !includeDeleted) {
      return;
    }
    merged.push({
      ...dish,
      source: dish.source || 'family'
    });
  });

  return merged;
}

module.exports = {
  CATALOG_PATH,
  loadCatalog,
  listRecipes,
  getVersion,
  getRecipe,
  findByName,
  toRecipeItem,
  mergeRecipes,
  mergePoolDishes
};
