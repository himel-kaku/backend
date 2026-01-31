const pool = require('../config/database');

const getProfile = async (req, res) => {
  try {
    const { userId, role } = req.user;

    let query;
    let result;

    if (role === 'student') {
      query = `
        SELECT 
          s.student_id,
          s.stu_name,
          s.level,
          s.term,
          s.role as student_role,
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

    if (role === 'student') {
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

    if (role === 'student') {
      // Fetches schedule for courses where the student is enrolled IN their specific section
      query = `
        SELECT 
          cs.id as schedule_id,
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
        courseCode: item.course_code,
        courseTitle: item.course_title,
        courseType: item.course_type,
        section: item.section,
        date: item.date,
        day: item.day_of_week.trim(), // PostgreSQL pads 'Day' with spaces
        startTime: item.start_time,
        endTime: item.end_time,
        location: `${item.building_name}, Room ${item.room}`,
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

    if (role === 'student') {
      // Fetches exam schedule for the specific courses and sections the student is enrolled in
      query = `
        SELECT 
          es.id as exam_id,
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


module.exports = { getProfile, getMyCourses, getClassRoutine, getExamRoutine };
