const express = require('express');
const router = express.Router();
const Auth = require('../apis/auth');
const authMiddleware = require('../apis/authMiddleware');
const Session = require('../models/session');
const { Op } = require('sequelize');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 userId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Invalid request or username already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const role = 'Participant';
    const userId = await Auth.register(username, password, role);
    res.json({ success: true, userId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful. Sets a session cookie.
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: sessionId=abcde12345; HttpOnly; Secure; SameSite=Strict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [Admin, Organizer, Participant]
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const loginResult = await Auth.login(username, password);
    
    // Set the session cookie
    res.cookie(
      loginResult.sessionCookie.name,
      loginResult.sessionCookie.value,
      loginResult.sessionCookie.options
    );

    // For debugging
    console.log('Setting session cookie:', loginResult.sessionCookie);

    res.json({
      user: loginResult.user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const sessionId = req.headers.authorization;
    await Auth.logout(sessionId);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/change-role:
 *   put:
 *     summary: Change user role (Admin only)
 *     tags: [Authentication]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - newRole
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               newRole:
 *                 type: string
 *                 enum: [Admin, Organizer]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       403:
 *         description: Unauthorized - Requires Admin role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/change-role', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized. Requires Admin role' });
    }

    const { userId, newRole } = req.body;
    
    if (newRole !== 'Admin' && newRole !== 'Organizer') {
      return res.status(400).json({ error: 'Invalid role. Must be Admin or Organizer' });
    }

    await Auth.changeUserRole(userId, newRole);
    res.json({ success: true, message: 'Role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add session verification middleware
const verifySession = async (req, res, next) => {
  const sessionId = req.cookies.sessionId;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }

  try {
    const session = await Session.findOne({
      where: {
        id: sessionId,
        expiresAt: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.session = session;
    next();
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Use this middleware for protected routes
router.get('/protected-route', verifySession, (req, res) => {
  // Your protected route logic
});

module.exports = router; 