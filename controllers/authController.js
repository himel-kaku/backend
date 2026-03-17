const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const login = async (req, res) => {
  try {
    const { id, password } = req.body;
    console.log('Login attempt with ID:', id);
    
    if (!id || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both id and password'
      });
    }

    let user = null;
    let role = null;

    // Check student table
    const studentQuery = `
      SELECT s.*, d.name as department_name, d.dept_code
      FROM student s
      LEFT JOIN department d ON s.department_id = d.dept_id
      WHERE s.student_id = $1 AND s.password = $2
    `;
    const studentResult = await pool.query(studentQuery, [id, password]);

    if (studentResult.rows.length > 0) {
      user = studentResult.rows[0];
      role = user.role.toLowerCase() === 'cr' ? 'cr' : 'student'; // Distinguish between CR and regular student
    } else {
      // Check teacher table
      const teacherQuery = `
        SELECT t.*, d.name as department_name, d.dept_code
        FROM teacher t
        LEFT JOIN department d ON t.department_id = d.dept_id
        WHERE t.teacher_id = $1 AND t.password = $2
      `;
      const teacherResult = await pool.query(teacherQuery, [id, password]);

      if (teacherResult.rows.length > 0) {
        user = teacherResult.rows[0];
        role = 'teacher';
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    //JWT token
    const token = jwt.sign(
      { 
        userId: role === 'teacher' ? user.teacher_id : user.student_id,
        role: role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Removing password from response
    delete user.password;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: (role === 'student' || role==='cr') ? user.student_id : user.teacher_id,
        name:  (role === 'student' || role==='cr')? user.stu_name : user.teacher_name,
        role: role,
        department: user.department_name,
        departmentCode: user.dept_code,
        ...( (role === 'student' || role==='cr') && {
          level: user.level,
          term: user.term,
          studentRole: user.role
        })
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

module.exports = { login };
