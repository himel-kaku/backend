const express = require('express');
const router = express.Router();
const { uploadClassFile } = require('../controllers/fileController');
const upload = require('../middleware/uploadConfig');
const authMiddleware = require('../middleware/auth');

// Using .single('file') because the request contains one file
router.post('/class-files', authMiddleware, upload.single('file'), uploadClassFile);// input tags name is 'file'

module.exports = router;