const express = require('express');
const feedbackController = require('../controllers/feedback.controller');

const router = express.Router();

router.post('/feedback', feedbackController.submitFeedback);
router.get('/feedback/list', feedbackController.listMyFeedback);
router.get('/admin/feedback/list', feedbackController.listAdminFeedback);
router.post('/admin/feedback/reply', feedbackController.replyFeedback);

module.exports = router;
