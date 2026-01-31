const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getProfile, getMyCourses, getClassRoutine, getExamRoutine } = require('../controllers/userController');
const { getCourseMaterials, getExamPlot } = require('../controllers/fileController');

router.get('/profile', authMiddleware, getProfile);
router.get('/my-courses', authMiddleware, getMyCourses);// return course list
router.get('/class-routine', authMiddleware, getClassRoutine);// return class schedules
router.get('/exam-routine', authMiddleware, getExamRoutine);// return exam schedules
router.get('/course-materials/:courseId', authMiddleware, getCourseMaterials);// get all class plots and files(just name) for a course
router.get('/exam-materials/:examId', authMiddleware, getExamPlot);// send an exam schedule id and get its corresponding exam plots files

module.exports = router;
