const express = require('express');
const familyController = require('../controllers/family.controller');
const familyRecipeController = require('../controllers/familyRecipe.controller');
const familyShoppingController = require('../controllers/familyShopping.controller');
const familyIngredientController = require('../controllers/familyIngredient.controller');
const familyDataController = require('../controllers/familyData.controller');

const router = express.Router();

router.post('/createFamily', familyController.createFamily);
router.get('/getFamily', familyController.getFamily);
router.post('/updateFamily', familyController.updateFamily);
router.post('/deleteFamily', familyController.deleteFamily);
router.get('/getFamilyMembers', familyController.listFamilyMembers);

router.post('/saveFamilyRecipe', familyRecipeController.uploadFamilyRecipe);
router.post('/joinFamily', familyRecipeController.joinFamily);
router.get('/getFamilyRecipeByMember', familyRecipeController.getFamilyRecipeByMember);
router.get('/getFamilyRecipe', familyRecipeController.getFamilyRecipe);

router.post('/saveFamilyShoppingItem', familyShoppingController.upsertItem);
router.get('/getFamilyShoppingItem', familyShoppingController.getItem);
router.get('/getFamilyShoppingItems', familyShoppingController.listItemsByMember);
router.get('/getFamilyShoppingChanges', familyShoppingController.getChangesByMember);
router.post('/deleteFamilyShoppingItem', familyShoppingController.deleteItem);

router.post('/saveFamilyIngredientItem', familyIngredientController.upsertItem);
router.get('/getFamilyIngredientItem', familyIngredientController.getItem);
router.get('/getFamilyIngredientItems', familyIngredientController.listItemsByMember);
router.get('/getFamilyIngredientChanges', familyIngredientController.getChangesByMember);
router.post('/deleteFamilyIngredientItem', familyIngredientController.deleteItem);

router.get('/getFamilyData', familyDataController.getFamilyJsonData);

module.exports = router;
