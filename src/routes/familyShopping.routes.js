const express = require('express');
const familyShoppingController = require('../controllers/familyShopping.controller');

const router = express.Router();

router.post('/items', familyShoppingController.upsertItem);
router.get('/member/:memberCode/items', familyShoppingController.listItemsByMember);
router.get('/member/:memberCode/changes', familyShoppingController.getChangesByMember);
router.delete('/items/:itemId', familyShoppingController.deleteItem);

module.exports = router;
