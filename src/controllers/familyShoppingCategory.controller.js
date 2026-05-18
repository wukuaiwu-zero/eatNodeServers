const familyShoppingCategoryService = require('../services/familyShoppingCategory.service');
const { createFamilyCategoryController } = require('./familyCategory.controller');

module.exports = createFamilyCategoryController(
  familyShoppingCategoryService,
  'shoppingCategoryJson'
);
