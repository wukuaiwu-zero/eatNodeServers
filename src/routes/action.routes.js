const express = require('express');
const deviceController = require('../controllers/device.controller');
const familyController = require('../controllers/family.controller');
const familyRecipeController = require('../controllers/familyRecipe.controller');
const familyShoppingController = require('../controllers/familyShopping.controller');
const familyIngredientController = require('../controllers/familyIngredient.controller');
const familyDataController = require('../controllers/familyData.controller');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

const deviceLimiter = createRateLimiter({
  keyPrefix: 'device',
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: '设备相关请求太频繁，请稍后再试'
});
const familyLimiter = createRateLimiter({
  keyPrefix: 'family',
  windowMs: 10 * 60 * 1000,
  max: 1000,
  message: '家庭相关请求太频繁，请稍后再试'
});
const writeLimiter = createRateLimiter({
  keyPrefix: 'write',
  windowMs: 60 * 1000,
  max: 120,
  message: '写入请求太频繁，请稍后再试'
});

router.post('/registerDevice', deviceLimiter, deviceController.registerDevice);

router.post('/createFamily', familyLimiter, familyController.createFamily);
router.get('/getFamily', familyController.getFamily);
router.post('/updateFamily', writeLimiter, familyController.updateFamily);
router.post('/deleteFamily', familyLimiter, familyController.deleteFamily);
router.get('/getFamilyMembers', familyController.listFamilyMembers);
router.post('/createFamilyInvite', familyLimiter, familyController.createFamilyInvite);

router.post('/saveFamilyRecipe', writeLimiter, familyRecipeController.uploadFamilyRecipe);
router.post('/joinFamily', familyLimiter, familyRecipeController.joinFamily);
router.get('/getFamilyRecipeByMember', familyRecipeController.getFamilyRecipeByMember);
router.get('/getFamilyRecipe', familyRecipeController.getFamilyRecipe);

router.post('/saveFamilyShoppingItem', writeLimiter, familyShoppingController.upsertItem);
router.get('/getFamilyShoppingItem', familyShoppingController.getItem);
router.get('/getFamilyShoppingItems', familyShoppingController.listItemsByMember);
router.get('/getFamilyShoppingChanges', familyShoppingController.getChangesByMember);
router.post('/deleteFamilyShoppingItem', writeLimiter, familyShoppingController.deleteItem);

router.post('/saveFamilyIngredientItem', writeLimiter, familyIngredientController.upsertItem);
router.get('/getFamilyIngredientItem', familyIngredientController.getItem);
router.get('/getFamilyIngredientItems', familyIngredientController.listItemsByMember);
router.get('/getFamilyIngredientChanges', familyIngredientController.getChangesByMember);
router.post('/deleteFamilyIngredientItem', writeLimiter, familyIngredientController.deleteItem);

router.get('/getFamilyData', familyDataController.getFamilyJsonData);

module.exports = router;
