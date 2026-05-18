const { createFamilyCategoryService } = require('./familyCategory.service');

module.exports = createFamilyCategoryService({
  tableName: 'family_shopping_categories',
  idPrefix: 'shopping_cat',
  defaultCategories: [
    { id: 'shopping_cat_staple', name: '主食', sortOrder: 10 },
    { id: 'shopping_cat_vegetable', name: '蔬菜', sortOrder: 20 },
    { id: 'shopping_cat_meat', name: '肉类', sortOrder: 30 },
    { id: 'shopping_cat_egg_dairy', name: '蛋奶', sortOrder: 40 },
    { id: 'shopping_cat_seasoning', name: '调味', sortOrder: 50 },
    { id: 'shopping_cat_other', name: '其他', sortOrder: 900 }
  ]
});
