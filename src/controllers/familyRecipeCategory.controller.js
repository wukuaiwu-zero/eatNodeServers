const familyRecipeCategoryService = require('../services/familyRecipeCategory.service');
const { createFamilyCategoryController } = require('./familyCategory.controller');

module.exports = createFamilyCategoryController(
  familyRecipeCategoryService,
  'recipeCategoryJson'
);
