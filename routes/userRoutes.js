const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getProfile, getMyCourses, getClassRoutine, getExamRoutine } = require('../controllers/userController');

router.get('/profile', authMiddleware, getProfile);
router.get('/my-courses', authMiddleware, getMyCourses);
router.get('/class-routine', authMiddleware, getClassRoutine);
router.get('/exam-routine', authMiddleware, getExamRoutine)

module.exports = router;
