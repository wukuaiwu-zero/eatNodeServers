const express = require('express');
const familyController = require('../controllers/family.controller');

const router = express.Router();

router.post('/', familyController.createFamily);
router.get('/:familyCode', familyController.getFamily);
router.patch('/:familyCode', familyController.updateFamily);
router.delete('/:familyCode', familyController.deleteFamily);
router.get('/:familyCode/members', familyController.listFamilyMembers);

module.exports = router;
