const express = require('express');
const familyIngredientController = require('../controllers/familyIngredient.controller');

const router = express.Router();

router.post('/items', familyIngredientController.upsertItem);
router.get('/member/:memberCode/items', familyIngredientController.listItemsByMember);
router.get('/member/:memberCode/changes', familyIngredientController.getChangesByMember);
router.delete('/items/:itemId', familyIngredientController.deleteItem);

module.exports = router;
