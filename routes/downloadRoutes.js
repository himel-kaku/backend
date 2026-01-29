const express = require('express');
const router = express.Router();
const {downloadFile} = require('../controllers/fileController');
const authMiddleware = require('../middleware/auth');

// Using .single('file') because the request contains one file
router.get('/:fileId', authMiddleware, downloadFile);

module.exports = router;