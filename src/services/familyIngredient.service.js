const { createFamilyItemCollectionService } = require('./familyItemCollection.service');

module.exports = createFamilyItemCollectionService({
  tableName: 'family_ingredient_items',
  itemType: 'ingredient'
});
