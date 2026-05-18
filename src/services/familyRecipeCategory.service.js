const { createFamilyCategoryService } = require('./familyCategory.service');

module.exports = createFamilyCategoryService({
  tableName: 'family_recipe_categories',
  idPrefix: 'recipe_cat',
  defaultCategories: [
    { id: 'recipe_cat_home', name: '家常菜', sortOrder: 10 },
    { id: 'recipe_cat_cold', name: '凉菜', sortOrder: 20 },
    { id: 'recipe_cat_soup', name: '汤羹', sortOrder: 30 },
    { id: 'recipe_cat_staple', name: '主食', sortOrder: 40 },
    { id: 'recipe_cat_breakfast', name: '早餐', sortOrder: 50 },
    { id: 'recipe_cat_other', name: '其他', sortOrder: 900 }
  ]
});
