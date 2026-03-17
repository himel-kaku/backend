const { get } = require('http');
const pool = require('../config/database');
const path = require('path');


const handleFileUpload = (isPlotClass) => {
    return async (req, res) => {
        try {
            const { plot_id } = req.body;
            const file = req.file;
            // console.log(`Received file upload request for plot_id: ${plot_id}, isPlotClass: ${isPlotClass} ${file ? file.originalname : 'No file'}`);
            // console.log(req.pid);

            if (!file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }

            if (!plot_id) {
                return res.status(400).json({ success: false, message: 'plot_id is required' });
            }

            // console.log(`Uploading ${isPlotClass === 1 ? 'class' : 'exam'} file for plot_id:`, plot_id);
            const query = `
                INSERT INTO uploaded_files (file_name, file_path, plot_id, is_plot_class)
                VALUES ($1, $2, $3, $4)
                RETURNING *;
            `;

            const values = [
                file.originalname, 
                file.path,         
                plot_id,
                isPlotClass        // This comes from the outer function parameter
            ];

            const result = await pool.query(query, values);

            res.status(201).json({
                success: true,
                message: `${isPlotClass === 1 ? 'Class' : 'Exam'} file uploaded successfully`,
                file: result.rows[0]
            });

        } catch (error) {
            console.error('Upload Error:', error);
            res.status(500).json({ success: false, message: 'Server error during upload' });
        }
    };
};

// Export the specific versions
const uploadClassFile = handleFileUpload(1);
const uploadExamFile = handleFileUpload(0);


// 2. Get all plots for a specific course
const getCourseMaterials = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { userId } = req.user;

        // console.log(`Fetching materials for courseId: ${courseId}, userId: ${userId}`);

        // 1. Verify enrollment
        const enrollmentCheck = await pool.query(
            'SELECT section FROM student_course WHERE student_id = $1 AND course_id = $2',
            [userId, courseId]
        );

        if (enrollmentCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
        }

        const section = enrollmentCheck.rows[0].section;

        // 2. Simple JOIN Query
        // This returns one row per file. If a plot has no files, uf fields will be NULL.
        const query = `
            SELECT 
                cp.id as plot_id,
                cp.date,
                uf.id as file_id,
                uf.file_name,
                uf.uploaded_at
            FROM class_plots cp
            LEFT JOIN uploaded_files uf ON cp.id = uf.plot_id AND uf.is_plot_class = 1
            WHERE cp.course_id = $1 AND cp.section = $2
            ORDER BY cp.date DESC, uf.uploaded_at ASC;
        `;

        const result = await pool.query(query, [courseId, section]);

        // 3. Grouping rows by Plot ID in JavaScript
        const plotsMap = {};

        result.rows.forEach(row => {
            // If we haven't seen this plot_id yet, initialize it
            if (!plotsMap[row.plot_id]) {
                plotsMap[row.plot_id] = {
                    plot_id: row.plot_id,
                    date: row.date,
                    files: []
                };
            }

            // If a file exists for this row, push it into the files array
            if (row.file_id) {
                plotsMap[row.plot_id].files.push({
                    file_id: row.file_id,
                    file_name: row.file_name,
                    uploaded_at: row.uploaded_at
                });
            }
        });

        // Convert the map back into an array for the JSON response
        const formattedPlots = Object.values(plotsMap);

        res.status(200).json({
            success: true,
            course_id: courseId,
            section: section,
            plots: formattedPlots
        });

    } catch (error) {
        console.error('Fetch Materials Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching materials' });
    }
};


// Get all exam resources for a specific course
const getExamCourseMaterials = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { userId } = req.user;

        // 1. Verify enrollment (Same as Class Resources)
        const enrollmentCheck = await pool.query(
            'SELECT section FROM student_course WHERE student_id = $1 AND course_id = $2',
            [userId, courseId]
        );

        if (enrollmentCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
        }

        const section = enrollmentCheck.rows[0].section;

        // 2. Query for Exams
        // Note: I'm assuming 'exam_plots' is your table name and 'is_plot_class = 0' identifies exams.
        // Adjust 'uf.is_plot_class = 0' if your flag for exams is different.
        const query = `
            SELECT 
                ep.id as exam_id,
                ep.date,
                uf.id as file_id,
                uf.file_name,
                uf.uploaded_at
            FROM exam_plots ep
            LEFT JOIN uploaded_files uf ON ep.id = uf.plot_id AND uf.is_plot_class = 0
            WHERE ep.course_id = $1 AND ep.section = $2
            ORDER BY ep.date DESC, uf.uploaded_at ASC;
        `;

        const result = await pool.query(query, [courseId, section]);

        // 3. Grouping rows by Exam ID
        const examsMap = {};

        result.rows.forEach(row => {
            if (!examsMap[row.exam_id]) {
                examsMap[row.exam_id] = {
                    id: row.exam_id, // Matches the 'id' key used in frontend
                    date: row.date,
                    files: []
                };
            }

            if (row.file_id) {
                examsMap[row.exam_id].files.push({
                    file_id: row.file_id,
                    file_name: row.file_name,
                    uploaded_at: row.uploaded_at
                });
            }
        });

        const formattedExams = Object.values(examsMap);

        res.status(200).json({
            success: true,
            course_id: courseId,
            section: section,
            exams: formattedExams // Key matches 'data.exams' in the frontend
        });

    } catch (error) {
        console.error('Fetch Exam Materials Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching exam materials' });
    }
};

const getClassPlot = async (req, res) => {
    try {
        const { classScheduleId } = req.params;
        const { userId } = req.user; 

        // console.log(`Fetching class plot for classScheduleId: ${classScheduleId}, userId: ${userId}`);

        const scheduleRes = await pool.query(
            `SELECT course_id,
                    UPPER(section) as section,
                    date
            FROM class_schedule WHERE id = $1`, 
            [classScheduleId]
        );

        if (scheduleRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Class schedule not found' });
        }

        const { course_id, section, date } = scheduleRes.rows[0];

        const enrollmentCheck = await pool.query(
            'SELECT section FROM student_course WHERE student_id = $1 AND course_id = $2',
            [userId, course_id]
        );

        if (enrollmentCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
        }

        const query = `
            SELECT 
                cp.id as plot_id,
                cp.date,
                uf.id as file_id,
                uf.file_name,
                uf.uploaded_at
            FROM class_plots cp
            LEFT JOIN uploaded_files uf
            ON cp.id = uf.plot_id AND uf.is_plot_class = 1
            WHERE cp.course_id = $1 AND cp.section = $2 AND cp.date = $3
        `;

        const result = await pool.query(query, [course_id, section, date]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Class plot not found' });
        }

        const plotData = {
            plot_id: result.rows[0].plot_id,
            date: result.rows[0].date,
            files: []
        };

        result.rows.forEach(row => {
            if (row.file_id) {
                plotData.files.push({
                    file_id: row.file_id,
                    file_name: row.file_name,
                    uploaded_at: row.uploaded_at
                });
            }
        });

        res.status(200).json({
             success: true,
             plot: plotData 
        });

    } catch (error) {
        console.error("Error in getClassPlot:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


const getExamPlot = async (req, res) => {
    try {
        const { examScheduleId } = req.params;
        const { userId } = req.user; // From authMiddleware

        console.log(`Fetching exam plot for examScheduleId: ${examScheduleId}, userId: ${userId}`);

        const scheduleRes = await pool.query(
            `SELECT course_id,
                    section,
                    date
            FROM exam_schedule WHERE id = $1`, 
            [examScheduleId]
        );

        if (scheduleRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam schedule not found' });
        }

        const { course_id, section, date } = scheduleRes.rows[0];
        console.log(`Exam details - course_id: ${course_id}, section: ${section}, date: ${date}`);

        // check if student is enrolled in the course could be added here
        const enrollmentCheck = await pool.query(
            'SELECT section FROM student_course WHERE student_id = $1 AND course_id = $2',
            [userId, course_id]
        );

        if (enrollmentCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
        }


        const query = `
            SELECT 
                ep.id as plot_id,
                ep.date,
                uf.id as file_id,
                uf.file_name,
                uf.uploaded_at
            FROM exam_plots ep
            LEFT JOIN uploaded_files uf
            ON ep.id = uf.plot_id AND uf.is_plot_class = 0
            WHERE ep.course_id = $1 AND ep.section = $2 AND ep.date = $3
        `;

        const result = await pool.query(query, [course_id, section, date]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Plot not found' });
        }

        const plotData = {
            plot_id: result.rows[0].plot_id,
            date: result.rows[0].date,
            files: []
        };

        // Populate files array if file_id is not null (due to LEFT JOIN)
        result.rows.forEach(row => {
            if (row.file_id) {
                plotData.files.push({
                    file_id: row.file_id,
                    file_name: row.file_name,
                    uploaded_at: row.uploaded_at
                });
            }
        });

        res.status(200).json({
             success: true,
             plot: plotData 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


// Download/View the actual file
const downloadFile = async (req, res) => {
    try {
        const { fileId } = req.params;

        console.log(`Downloading file with ID: ${fileId}`);
        
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
    uploadExamFile,
    getCourseMaterials, 
    getExamCourseMaterials,
    getClassPlot,
    getExamPlot,
    downloadFile
};
