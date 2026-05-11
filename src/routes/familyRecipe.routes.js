const express = require('express');
const familyRecipeController = require('../controllers/familyRecipe.controller');

const router = express.Router();

router.post('/upload', familyRecipeController.uploadFamilyRecipe);
router.post('/join', familyRecipeController.joinFamily);
router.get('/member/:memberCode', familyRecipeController.getFamilyRecipeByMember);
router.get('/:familyCode', familyRecipeController.getFamilyRecipe);

module.exports = router;
