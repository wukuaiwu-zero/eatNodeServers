const familyShoppingService = require('../services/familyShopping.service');
const { createFamilyItemCollectionController } = require('./familyItemCollection.controller');

module.exports = createFamilyItemCollectionController(familyShoppingService, 'shoppingItemJson');
