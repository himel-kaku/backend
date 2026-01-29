const pool = require('../config/database');
const path = require('path');

// 1. upload a class file associated with a class-plots
const uploadClassFile = async (req, res) => {
    try {
        const { plot_id } = req.body; // Sent as text field in form-data
        const file = req.file;        // Populated by multer

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        if (!plot_id) {
            return res.status(400).json({ success: false, message: 'plot_id is required' });
        }

        const query = `
            INSERT INTO uploaded_files (file_name, file_path, plot_id, is_plot_class)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const values = [
            file.originalname, // Original name for display
            file.path,         // Full path for retrieval
            plot_id,
            1                  // Always 1 for class files per your requirement
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'File uploaded and saved to database successfully',
            file: result.rows[0]
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ success: false, message: 'Server error during upload' });
    }
};


// 2. Get all plots for a specific course with their file info
const getCourseMaterials = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { userId } = req.user; // From authMiddleware

        // First, verify the student is actually enrolled in this course to see files
        const enrollmentCheck = await pool.query(
            'SELECT section FROM student_course WHERE student_id = $1 AND course_id = $2',
            [userId, courseId]
        );

        if (enrollmentCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
        }

        const section = enrollmentCheck.rows[0].section;

        // Query to get plots and their associated files
        const query = `
            SELECT 
                cp.id as plot_id,
                cp.date,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'file_id', uf.id,
                            'file_name', uf.file_name,
                            'uploaded_at', uf.uploaded_at
                        )
                    ) FILTER (WHERE uf.id IS NOT NULL), '[]'
                ) as files
            FROM class_plots cp
            LEFT JOIN uploaded_files uf ON cp.id = uf.plot_id AND uf.is_plot_class = 1
            WHERE cp.course_id = $1 AND cp.section = $2
            GROUP BY cp.id, cp.date
            ORDER BY cp.date DESC;
        `;

        const result = await pool.query(query, [courseId, section]);

        res.status(200).json({
            success: true,
            course_id: courseId,
            section: section,
            plots: result.rows
        });

    } catch (error) {
        console.error('Fetch Materials Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching materials' });
    }
};

// 3. Download/View the actual file
const downloadFile = async (req, res) => {
    try {
        const { fileId } = req.params;

        const result = await pool.query(
            'SELECT file_path, file_name FROM uploaded_files WHERE id = $1',
            [fileId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const file = result.rows[0];
        const absolutePath = path.resolve(file.file_path);

        // res.download sends the file as an attachment
        res.download(absolutePath, file.file_name);
        
    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).json({ success: false, message: 'Could not download file' });
    }
};

module.exports = { 
    uploadClassFile,
    getCourseMaterials, 
    downloadFile
};
