const { createFamilyItemCollectionService } = require('./familyItemCollection.service');

module.exports = createFamilyItemCollectionService({
  tableName: 'family_shopping_items'
});
