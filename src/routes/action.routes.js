const express = require('express');
const deviceController = require('../controllers/device.controller');
const familyController = require('../controllers/family.controller');
const familyRecipeController = require('../controllers/familyRecipe.controller');
const familyShoppingController = require('../controllers/familyShopping.controller');
const familyIngredientController = require('../controllers/familyIngredient.controller');
const familyCategorySyncController = require('../controllers/familyCategorySync.controller');
const familyShoppingCategoryController = require('../controllers/familyShoppingCategory.controller');
const familyIngredientCategoryController = require('../controllers/familyIngredientCategory.controller');
const familyRecipeCategoryController = require('../controllers/familyRecipeCategory.controller');
const familyRecipePoolController = require('../controllers/familyRecipePool.controller');
const familyDataController = require('../controllers/familyData.controller');
const familyConsumptionController = require('../controllers/familyConsumption.controller');
const familyDietPreferenceController = require('../controllers/familyDietPreference.controller');
const familyMemoController = require('../controllers/familyMemo.controller');
const familySecurityQuestionController = require('../controllers/familySecurityQuestion.controller');
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
const familyRecoveryLimiter = createRateLimiter({
  keyPrefix: 'family-recovery',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: '家庭恢复请求太频繁，请稍后再试'
});

router.post('/registerDevice', deviceLimiter, deviceController.registerDevice);

router.post('/createFamily', familyLimiter, familyController.createFamily);
router.get('/getMyFamilies', familyController.getMyFamilies);
router.get('/getFamily', familyController.getFamily);
router.post('/updateFamily', writeLimiter, familyController.updateFamily);
router.post('/deleteFamily', familyLimiter, familyController.deleteFamily);
router.get('/getFamilyMembers', familyController.listFamilyMembers);
router.post('/updateMyFamilyMemberProfile', writeLimiter, familyController.updateMyFamilyMemberProfile);
router.post('/leaveFamily', writeLimiter, familyController.leaveFamily);
router.post('/createFamilyInvite', familyLimiter, familyController.createFamilyInvite);

router.post('/saveFamilyRecipe', writeLimiter, familyRecipeController.uploadFamilyRecipe);
router.post('/saveFamilyRecipeItem', writeLimiter, familyRecipeController.saveFamilyRecipeItem);
router.post('/updateFamilyRecipeItem', writeLimiter, familyRecipeController.updateFamilyRecipeItem);
router.post('/deleteFamilyRecipeItem', writeLimiter, familyRecipeController.deleteFamilyRecipeItem);
router.post('/uploadFamilyRecipeCover', writeLimiter, familyRecipeController.uploadFamilyRecipeCover);
router.post('/joinFamily', familyLimiter, familyRecipeController.joinFamily);
router.get('/getFamilyRecipeByMember', familyRecipeController.getFamilyRecipeByMember);
router.get('/getFamilyRecipe', familyRecipeController.getFamilyRecipe);
router.get('/getFamilyRecipeItem', familyRecipeController.getFamilyRecipeItem);

router.post('/saveFamilyShoppingItem', writeLimiter, familyShoppingController.upsertItem);
router.post('/updateFamilyShoppingItem', writeLimiter, familyShoppingController.upsertItem);
router.get('/getFamilyShoppingItem', familyShoppingController.getItem);
router.get('/getFamilyShoppingItems', familyShoppingController.listItemsByMember);
router.get('/getFamilyShoppingChanges', familyShoppingController.getChangesByMember);
router.post('/deleteFamilyShoppingItem', writeLimiter, familyShoppingController.deleteItem);
router.post('/deleteFamilyShoppingItems', writeLimiter, familyShoppingController.deleteItems);
router.post('/clearPurchasedFamilyShoppingItems', writeLimiter, familyShoppingController.clearPurchasedItems);

router.post('/saveFamilyIngredientItem', writeLimiter, familyIngredientController.upsertItem);
router.post('/updateFamilyIngredientItem', writeLimiter, familyIngredientController.upsertItem);
router.get('/getFamilyIngredientItem', familyIngredientController.getItem);
router.get('/getFamilyIngredientItems', familyIngredientController.listItemsByMember);
router.get('/getFamilyIngredientChanges', familyIngredientController.getChangesByMember);
router.post('/deleteFamilyIngredientItem', writeLimiter, familyIngredientController.deleteItem);
router.post('/deleteFamilyIngredientItems', writeLimiter, familyIngredientController.deleteItems);
router.post('/clearExpiredFamilyIngredientItems', writeLimiter, familyIngredientController.clearExpiredItems);

router.post('/saveFamilyCategory', writeLimiter, familyCategorySyncController.saveCategory);

router.post('/saveFamilyShoppingCategory', writeLimiter, familyShoppingCategoryController.upsertCategory);
router.get('/getFamilyShoppingCategories', familyShoppingCategoryController.listCategories);
router.post('/deleteFamilyShoppingCategory', writeLimiter, familyShoppingCategoryController.deleteCategory);

router.post('/saveFamilyIngredientCategory', writeLimiter, familyIngredientCategoryController.upsertCategory);
router.get('/getFamilyIngredientCategories', familyIngredientCategoryController.listCategories);
router.post('/deleteFamilyIngredientCategory', writeLimiter, familyIngredientCategoryController.deleteCategory);

router.post('/saveFamilyRecipeCategory', writeLimiter, familyRecipeCategoryController.upsertCategory);
router.get('/getFamilyRecipeCategories', familyRecipeCategoryController.listCategories);
router.post('/deleteFamilyRecipeCategory', writeLimiter, familyRecipeCategoryController.deleteCategory);

router.post('/saveFamilyRecipePoolItem', writeLimiter, familyRecipePoolController.upsertDish);
router.get('/getFamilyRecipePoolItems', familyRecipePoolController.listDishes);
router.post('/deleteFamilyRecipePoolItem', writeLimiter, familyRecipePoolController.deleteDish);

router.post('/saveFamilyConsumptionRecord', writeLimiter, familyConsumptionController.upsertRecord);
router.post('/updateFamilyConsumptionRecord', writeLimiter, familyConsumptionController.upsertRecord);
router.get('/getFamilyConsumptionRecord', familyConsumptionController.getRecord);
router.get('/getFamilyConsumptionRecords', familyConsumptionController.listRecords);
router.post('/deleteFamilyConsumptionRecord', writeLimiter, familyConsumptionController.deleteRecord);

router.post('/saveFamilyDietPreference', writeLimiter, familyDietPreferenceController.upsertPreference);
router.post('/updateFamilyDietPreference', writeLimiter, familyDietPreferenceController.upsertPreference);
router.get('/getFamilyDietPreference', familyDietPreferenceController.getPreference);
router.get('/getFamilyDietPreferences', familyDietPreferenceController.listPreferences);
router.post('/deleteFamilyDietPreference', writeLimiter, familyDietPreferenceController.deletePreference);

router.post('/saveFamilyMemo', writeLimiter, familyMemoController.upsertMemo);
router.post('/updateFamilyMemo', writeLimiter, familyMemoController.upsertMemo);
router.get('/getFamilyMemo', familyMemoController.getMemo);
router.get('/getFamilyMemos', familyMemoController.listMemos);
router.post('/deleteFamilyMemo', writeLimiter, familyMemoController.deleteMemo);

router.post('/setFamilySecurityQuestion', writeLimiter, familySecurityQuestionController.setQuestion);
router.get('/getFamilySecurityQuestion', familySecurityQuestionController.getQuestion);
router.post(
  '/recoverFamilyBySecurityAnswer',
  familyRecoveryLimiter,
  familySecurityQuestionController.recoverFamily
);

router.get('/getFamilyData', familyDataController.getFamilyJsonData);

module.exports = router;
