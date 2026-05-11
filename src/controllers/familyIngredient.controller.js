const familyIngredientService = require('../services/familyIngredient.service');
const { createFamilyItemCollectionController } = require('./familyItemCollection.controller');

module.exports = createFamilyItemCollectionController(familyIngredientService, 'ingredientItemJson');
