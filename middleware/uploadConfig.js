const multer = require('multer');
const path = require('path'); 
const fs = require('fs');

// Ensure directory exists
const uploadClassDir = 'uploads/class';
if (!fs.existsSync(uploadClassDir)) {
    fs.mkdirSync(uploadClassDir, { recursive: true });
}

const classStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadClassDir);
    },
    filename: (req, file, cb) => {
        // Renaming file: timestamp + original name to ensure uniqueness
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadClass = multer({ 
    storage: classStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB Limit
});

// Ensure directory exists for exam files
const uploadExamDir = 'uploads/exam';
if (!fs.existsSync(uploadExamDir)) {
    fs.mkdirSync(uploadExamDir, { recursive: true });
}

const examStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadExamDir);
    },
    filename: (req, file, cb) => {
        // Renaming file: timestamp + original name to ensure uniqueness
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadExam = multer({ 
    storage: examStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB Limit
});

module.exports = {
    uploadClass: uploadClass,
    uploadExam: uploadExam
}