const familyRecipeService = require('./familyRecipe.service');
const familyIngredientCategoryService = require('./familyIngredientCategory.service');
const familyShoppingCategoryService = require('./familyShoppingCategory.service');
const familyRecipeCategoryService = require('./familyRecipeCategory.service');

const categoryServices = {
  ingredient: familyIngredientCategoryService,
  shopping: familyShoppingCategoryService,
  recipe: familyRecipeCategoryService
};

function createValidationError(message) {
  const error = new TypeError(message);
  return error;
}

function normalizeType(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCategoryInput(categoryJson) {
  if (typeof categoryJson === 'string') {
    return JSON.parse(categoryJson);
  }

  return categoryJson;
}

function getTargetTypes(sourceType, options = {}) {
  const targets = new Set([sourceType]);

  if (sourceType === 'ingredient' && Boolean(options.syncToShopping)) {
    targets.add('shopping');
  }

  if (sourceType === 'shopping' && Boolean(options.syncToIngredient)) {
    targets.add('ingredient');
  }

  return Array.from(targets);
}

async function saveCategoryByDevice(deviceId, familyCode, sourceType, categoryJson, options = {}) {
  const normalizedSourceType = normalizeType(sourceType);
  const sourceService = categoryServices[normalizedSourceType];
  const normalizedCategoryJson = normalizeCategoryInput(categoryJson);

  if (!sourceService) {
    throw createValidationError('分类类型只能是 ingredient、shopping 或 recipe');
  }

  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const targetTypes = getTargetTypes(normalizedSourceType, options);

  for (const targetType of targetTypes) {
    await categoryServices[targetType].assertCategoryNameAvailable(member.familyCode, normalizedCategoryJson);
  }

  const categories = {};

  for (const targetType of targetTypes) {
    const targetCategoryJson = targetType === normalizedSourceType
      ? normalizedCategoryJson
      : {
          name: normalizedCategoryJson.name,
          sortOrder: normalizedCategoryJson.sortOrder ?? normalizedCategoryJson.sort_order
        };
    categories[targetType] = await categoryServices[targetType].upsertCategoryByFamily(
      member.familyCode,
      member.memberCode,
      targetCategoryJson
    );
  }

  return {
    member,
    categories
  };
}

module.exports = {
  saveCategoryByDevice
};
