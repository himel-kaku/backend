const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getProfile, getMyCourses, getClassRoutine, getExamRoutine, updateClassSchedule, updateExamSchedule,createClassSchedule, createExamSchedule} = require('../controllers/userController');
const { getCourseMaterials, getExamCourseMaterials,getExamPlot , getClassPlot} = require('../controllers/fileController');

router.get('/profile', authMiddleware, getProfile);
router.get('/my-courses', authMiddleware, getMyCourses);// return course list
router.get('/class-routine', authMiddleware, getClassRoutine);// return class schedules
router.get('/exam-routine', authMiddleware, getExamRoutine);// return exam schedules
router.get('/course-materials/:courseId', authMiddleware, getCourseMaterials);// get all class plots and files(just name) for a course
router.get('/exam-course-materials/:courseId',authMiddleware, getExamCourseMaterials);// get all exam plots and files(just name) for a course
router.get('/exam-materials/:examScheduleId', authMiddleware, getExamPlot);// send an exam schedule id and get its corresponding exam plots files
router.get('/class-materials/:classScheduleId', authMiddleware, getClassPlot);// send a class schedule id and get its corresponding class plot


// Router
router.post('/update-class-schedule', authMiddleware, updateClassSchedule);
router.post('/create-class-schedule', authMiddleware, createClassSchedule);
router.post('/create-exam-schedule', authMiddleware, createExamSchedule);
router.post('/update-exam-schedule', authMiddleware, updateExamSchedule);


module.exports = router;
