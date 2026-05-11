const express = require('express');
const familyDataController = require('../controllers/familyData.controller');

const router = express.Router();

router.get('/member/:memberCode', familyDataController.getFamilyJsonData);

module.exports = router;
