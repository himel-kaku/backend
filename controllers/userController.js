const pool = require('../config/database');

const getProfile = async (req, res) => {
  try {
    const { userId, role } = req.user;

    let query;
    let result;

    if (role.toLowerCase() === 'student' || role.toLowerCase() === 'cr') {
      query = `
        SELECT 
          s.student_id,
          s.stu_name,
          s.level,
          s.term,
          UPPER(s.role) as student_role,
          s.department_id,
          d.name as department_name,
          d.dept_code,
          d.building_name
        FROM student s
        LEFT JOIN department d ON s.department_id = d.dept_id
        WHERE s.student_id = $1
      `;
      result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      const profile = result.rows[0];
      return res.status(200).json({
        success: true,
        profile: {
          id: profile.student_id,
          name: profile.stu_name,
          level: profile.level,
          term: profile.term,
          role: profile.student_role,
          department: {
            id: profile.department_id,
            name: profile.department_name,
            code: profile.dept_code,
            building: profile.building_name
          }
        }
      });

    } else if (role === 'teacher') {
      query = `
        SELECT 
          t.teacher_id,
          t.teacher_name,
          t.department_id,
          d.name as department_name,
          d.dept_code,
          d.building_name
        FROM teacher t
        LEFT JOIN department d ON t.department_id = d.dept_id
        WHERE t.teacher_id = $1
      `;
      result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Teacher not found'
        });
      }

      const profile = result.rows[0];
      return res.status(200).json({
        success: true,
        profile: {
          id: profile.teacher_id,
          name: profile.teacher_name,
          department: {
            id: profile.department_id,
            name: profile.department_name,
            code: profile.dept_code,
            building: profile.building_name
          }
        }
      });
    }

  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching profile',
      error: error.message
    });
  }
};

const getMyCourses = async (req, res) => {
  try {
    const { userId, role } = req.user;

    console.log(`Fetching courses for user ID: ${userId} with role: ${role}`);

    let query;
    let result;

    if (role.toLowerCase() === 'student' || role.toLowerCase() === 'cr') {
      query = `
        SELECT 
          c.id as course_id,
          c.course_code,
          c.course_title,
          c.course_type,
          sc.section,
          d.name as department_name,
          d.dept_code
        FROM student_course sc
        JOIN course c ON sc.course_id = c.id
        LEFT JOIN department d ON c.department_id = d.dept_id
        WHERE sc.student_id = $1
        ORDER BY c.course_code
      `;
      result = await pool.query(query, [userId]);

      return res.status(200).json({
        success: true,
        courses: result.rows.map(course => ({
          id: course.course_id,
          code: course.course_code,
          title: course.course_title,
          type: course.course_type,
          section: course.section,
          department: {
            name: course.department_name,
            code: course.dept_code
          }
        }))
      });

    } else if (role === 'teacher') {
      query = `
        SELECT 
          c.id as course_id,
          c.course_code,
          c.course_title,
          c.course_type,
          d.name as department_name,
          d.dept_code,
          COUNT(DISTINCT sc.student_id) as enrolled_students
        FROM course_teacher ct
        JOIN course c ON ct.course_id = c.id
        LEFT JOIN department d ON c.department_id = d.dept_id
        LEFT JOIN student_course sc ON c.id = sc.course_id
        WHERE ct.teacher_id = $1
        GROUP BY c.id, c.course_code, c.course_title, c.course_type, d.name, d.dept_code
        ORDER BY c.course_code
      `;
      result = await pool.query(query, [userId]);

      return res.status(200).json({
        success: true,
        courses: result.rows.map(course => ({
          id: course.course_id,
          code: course.course_code,
          title: course.course_title,
          type: course.course_type,
          department: {
            name: course.department_name,
            code: course.dept_code
          },
          enrolledStudents: parseInt(course.enrolled_students)
        }))
      });
    }

  } catch (error) {
    console.error('Courses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching courses',
      error: error.message
    });
  }
};

const getClassRoutine = async (req, res) => {
  try {
    const { userId, role } = req.user;
    let query;

    console.log(`Fetching class routine for user ID: ${userId} with role: ${role}`);

    if (role.toLowerCase() === 'student' || role.toLowerCase() === 'cr') {
      // Fetches schedule for courses where the student is enrolled IN their specific section
      query = `
        SELECT 
          cs.id as schedule_id,
          cs.course_id as course_id,
          c.course_code,
          c.course_title,
          c.course_type,
          cs.section,
          cs.date,
          TO_CHAR(cs.date, 'Day') as day_of_week,
          cs.start_time,
          cs.end_time,
          cs.building_name,
          cs.room,
          cs.is_regular
        FROM class_schedule cs
        JOIN course c ON cs.course_id = c.id
        JOIN student_course sc ON (sc.course_id = c.id AND sc.section = cs.section)
        WHERE sc.student_id = $1
        ORDER BY cs.date, cs.start_time;
      `;
    } else if (role === 'teacher') {
      // Fetches schedule for all sections of courses assigned to the teacher
      query = `
        SELECT 
          cs.id as schedule_id,
          cs.course_id as course_id,
          c.course_code,
          c.course_title,
          cs.section,
          cs.date,
          TO_CHAR(cs.date, 'Day') as day_of_week,
          cs.start_time,
          cs.end_time,
          cs.building_name,
          cs.room,
          cs.is_regular
        FROM class_schedule cs
        JOIN course c ON cs.course_id = c.id
        JOIN course_teacher ct ON ct.course_id = c.id
        WHERE ct.teacher_id = $1
        ORDER BY cs.date, cs.start_time;
      `;
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const result = await pool.query(query, [userId]);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      routine: result.rows.map(item => ({
        id: item.schedule_id,
        courseId: item.course_id,
        courseCode: item.course_code,
        courseTitle: item.course_title,
        courseType: item.course_type,
        section: item.section,
        date: item.date.toLocaleDateString('en-CA'),
        day: item.day_of_week.trim(), // PostgreSQL pads 'Day' with spaces
        startTime: item.start_time,
        endTime: item.end_time,
        building_name: item.building_name,
        room: item.room,
        isRegular: item.is_regular === 1
      }))
    });

  } catch (error) {
    console.error('Routine Fetch Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch class routine',
      error: error.message
    });
  }
};

const getExamRoutine = async (req, res) => {
  try {
    const { userId, role } = req.user;
    let query;

    console.log(`Fetching exam routine for user ID: ${userId} with role: ${role}`);

    if (role.toLowerCase() === 'student' || role.toLowerCase() === 'cr') {
      // Fetches exam schedule for the specific courses and sections the student is enrolled in
      query = `
        SELECT 
          es.id as exam_id,
          es.course_id as course_id,
          c.course_code,
          c.course_title,
          es.section,
          es.date,
          TO_CHAR(es.date, 'Day, DD Month YYYY') as formatted_date,
          es.start_time,
          es.end_time,
          es.building_name,
          es.room,
          es.exam_description
        FROM exam_schedule es
        JOIN course c ON es.course_id = c.id
        JOIN student_course sc ON (sc.course_id = c.id AND sc.section = es.section)
        WHERE sc.student_id = $1
        ORDER BY es.date ASC, es.start_time ASC;
      `;
    } else if (role === 'teacher') {
      // Fetches exam schedule for all courses assigned to the teacher
      query = `
        SELECT 
          es.id as exam_id,
          es.course_id as course_id,
          c.course_code,
          c.course_title,
          es.section,
          es.date,
          TO_CHAR(es.date, 'Day, DD Month YYYY') as formatted_date,
          es.start_time,
          es.end_time,
          es.building_name,
          es.room,
          es.exam_description
        FROM exam_schedule es
        JOIN course c ON es.course_id = c.id
        JOIN course_teacher ct ON ct.course_id = c.id
        WHERE ct.teacher_id = $1
        ORDER BY es.date ASC, es.start_time ASC;
      `;
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

    const result = await pool.query(query, [userId]);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      exams: result.rows.map(exam => ({
        id: exam.exam_id,
        courseId: exam.course_id,
        courseCode: exam.course_code,
        courseTitle: exam.course_title,
        section: exam.section,
        date: exam.date,
        dateLabel: exam.formatted_date.replace(/\s+/g, ' ').trim(), // Clean up PG padding
        startTime: exam.start_time.slice(0, 5),
        endTime: exam.end_time.slice(0, 5),
        venue: `${exam.building_name}, Room ${exam.room}`,
        description: exam.exam_description
      }))
    });

  } catch (error) {
    console.error('Exam Routine Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching exam routine',
      error: error.message
    });
  }
};




const createClassSchedule = async (req, res) => {
  try {
    const { userId, role } = req.user;

    // 1. Authorization Check: Only CR can create schedules
    if (role.toLowerCase() !== 'cr') {
      return res.status(403).json({ 
        success: false, 
        message: role 
      });
    }

    const {
      course_id,      // frontend sends courseId
      section,
      date,
      start_time,     // frontend sends startTime
      end_time,       // frontend sends endTime
      building_name,  // frontend sends buildingName
      room,
      is_regular
    } = req.body;

    // 2. Basic Validation
    if (!course_id || !section || !date || !start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields (Course, Section, Date, and Times)' 
      });
    }

    // 3. Enrollment Check: Ensure the CR is actually enrolled in this course
    const courseEnrollmentCheckQuery = await pool.query(
      'SELECT * FROM student_course WHERE student_id = $1 AND course_id = $2',
      [userId, course_id]
    );

    if (courseEnrollmentCheckQuery.rowCount === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: You can only create schedules for courses you are enrolled in' 
      });
    }

    // 4. INSERT Query
    const query = `
      INSERT INTO class_schedule (
        course_id, 
        section, 
        date, 
        start_time, 
        end_time, 
        building_name, 
        room, 
        is_regular
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const values = [
      course_id,
      section,
      date,          // Expected format: 'YYYY-MM-DD'
      start_time,     // Expected format: 'HH:mm:ss'
      end_time,       // Expected format: 'HH:mm:ss'
      building_name,
      room,
      is_regular ? 1 : 0
    ];

    const result = await pool.query(query, values);

    // 5. Success Response
    return res.status(201).json({
      success: true,
      message: 'Class schedule created successfully',
      newSchedule: result.rows[0]
    });

  } catch (error) {
    console.error('Create Class Schedule Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create class schedule',
      error: error.message
    });
  }
};


const createExamSchedule = async (req, res) => {
  try {
    const { userId, role } = req.user;

    // 1. Authorization Check: Only CR can create exam schedules
    if (role.toLowerCase() !== 'cr') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: Only Class Representatives can schedule exams' 
      });
    }

    const {
      course_id,
      section,
      date,
      start_time,
      end_time,
      building_name,
      room,
      exam_description
    } = req.body;

    // 2. Basic Validation
    if (!course_id || !section || !date || !start_time || !end_time || !exam_description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields (Course, Section, Date, Times, and Description)' 
      });
    }

    // 3. Enrollment Check: Ensure the CR is enrolled in this course
    const courseEnrollmentCheckQuery = await pool.query(
      'SELECT * FROM student_course WHERE student_id = $1 AND course_id = $2',
      [userId, course_id]
    );

    if (courseEnrollmentCheckQuery.rowCount === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: You can only schedule exams for courses you are enrolled in' 
      });
    }

    // 4. INSERT Query for exam_schedule
    // The trigger we created earlier will automatically create the row in exam_plots
    const query = `
      INSERT INTO exam_schedule (
        course_id, 
        section, 
        date, 
        start_time, 
        end_time, 
        building_name, 
        room, 
        exam_description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const values = [
      course_id,
      section,
      date,           // format: 'YYYY-MM-DD'
      start_time,     // format: 'HH:mm:ss'
      end_time,       // format: 'HH:mm:ss'
      building_name,
      room,
      exam_description
    ];

    const result = await pool.query(query, values);

    // 5. Success Response
    return res.status(201).json({
      success: true,
      message: 'Exam schedule created successfully',
      newExam: result.rows[0]
    });

  } catch (error) {
    console.error('Create Exam Schedule Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create exam schedule',
      error: error.message
    });
  }
};

// Controller
const updateClassSchedule = async (req, res) => {
  try {
    const { userId, role } = req.user;

    if (role.toLowerCase() !== 'cr') {
      return res.status(403).json({ success: false, message: 'Only CRs can update class schedules' });
    }

    
    const {
      id,           // schedule ID to update
      course_id,
      section,
      date,
      start_time,
      end_time,
      building_name,
      room,
      is_regular
    } = req.body;

    // Validation
    if (!id) {
      return res.status(400).json({ success: false, message: 'Schedule ID is required' });
    }

    const courseEnrollmentCheckQuery = await pool.query(
      'SELECT * FROM student_course WHERE student_id = $1 AND course_id = $2',
      [userId, course_id]
    );
    if(courseEnrollmentCheckQuery.rowCount === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You are not enrolled in this course' });
    }

    if(is_regular == 0){
       const deleteScheduleQuery = `
        DELETE FROM class_schedule
        WHERE id = $1;
      `;
      await pool.query(deleteScheduleQuery, [id]);
      return res.status(200).json({
        success: true,
        message: 'Class schedule deleted successfully'
      });
    }

    const query = `
      UPDATE class_schedule
      SET 
        course_id = $1,
        section = $2,
        date = $3,
        start_time = $4,
        end_time = $5,
        building_name = $6,
        room = $7,
        is_regular = $8
      WHERE id = $9
      RETURNING *;
    `;

    const values = [
      course_id,
      section,
      date,         // send as 'YYYY-MM-DD'
      start_time,    // send as 'HH:mm:ss'
      end_time,
      building_name,
      room,
      is_regular ? 1 : 0,
      id
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Class schedule updated successfully',
      updatedSchedule: result.rows[0]
    });

  } catch (error) {
    console.error('Update Class Schedule Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update class schedule',
      error: error.message
    });
  }
};

const updateExamSchedule = async (req, res) => {
  try {
    const { userId, role } = req.user;

    // Check if the user is a CR
    if (role.toLowerCase() !== 'cr') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only CRs can update exam schedules' 
      });
    }

    const {
      id,               // Exam schedule ID to update
      course_id,
      section,
      date,
      start_time,
      end_time,
      building_name,
      room,
      exam_description
    } = req.body;

    // Basic Validation
    if (!id || !course_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Exam ID and Course ID are required' 
      });
    }

    // Security Check: Verify CR is enrolled in the course they are trying to update
    const courseEnrollmentCheckQuery = await pool.query(
      'SELECT * FROM student_course WHERE student_id = $1 AND course_id = $2',
      [userId, course_id]
    );

    if (courseEnrollmentCheckQuery.rowCount === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: You are not enrolled in this course' 
      });
    }

    // SQL Query to update exam_schedule
    const query = `
      UPDATE exam_schedule
      SET 
        course_id = $1,
        section = $2,
        date = $3,
        start_time = $4,
        end_time = $5,
        building_name = $6,
        room = $7,
        exam_description = $8
      WHERE id = $9
      RETURNING *;
    `;

    const values = [
      course_id,
      section,
      date,           // Expecting 'YYYY-MM-DD'
      start_time,     // Expecting 'HH:mm:ss'
      end_time,
      building_name,
      room,
      exam_description,
      id
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Exam schedule not found' 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Exam schedule updated successfully',
      updatedExam: result.rows[0]
    });

  } catch (error) {
    console.error('Update Exam Schedule Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update exam schedule',
      error: error.message
    });
  }
};

module.exports = { getProfile, getMyCourses, getClassRoutine, getExamRoutine, updateClassSchedule,updateExamSchedule, createClassSchedule, createExamSchedule };
