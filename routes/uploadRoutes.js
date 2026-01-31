const express = require('express');
const router = express.Router();
const { uploadClassFile, uploadExamFile } = require('../controllers/fileController');
const { uploadClass, uploadExam} = require('../middleware/uploadConfig');
const authMiddleware = require('../middleware/auth');

// Using .single('file') because the request contains one file
router.post('/class-files', authMiddleware, uploadClass.single('file'), uploadClassFile);// input tags name is 'file'
router.post('/exam-files', authMiddleware, uploadExam.single('file'), uploadExamFile);// input tags name is 'file'

module.exports = router;