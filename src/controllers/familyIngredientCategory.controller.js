const familyIngredientCategoryService = require('../services/familyIngredientCategory.service');
const { createFamilyCategoryController } = require('./familyCategory.controller');

module.exports = createFamilyCategoryController(
  familyIngredientCategoryService,
  'ingredientCategoryJson'
);
