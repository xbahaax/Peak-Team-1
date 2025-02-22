const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../apis/authMiddleware');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/resumes';
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename based on user ID
    const userId = req.user.id;
    cb(null, `CV_${userId}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept only PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * @swagger
 * /api/users/resume:
 *   post:
 *     summary: Upload user resume (PDF only)
 *     tags: [Users]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               resume:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Resume uploaded successfully
 *       400:
 *         description: Invalid file format or size
 *       401:
 *         description: Unauthorized
 */
router.post('/resume', 
  authMiddleware,
  (req, res) => {
    upload.single('resume')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer error (e.g., file too large)
        return res.status(400).json({ error: 'File upload error: ' + err.message });
      } else if (err) {
        // Other errors (e.g., wrong file type)
        return res.status(400).json({ error: err.message });
      }

      // Check if file was provided
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      res.json({
        success: true,
        message: 'Resume uploaded successfully',
        filename: req.file.filename
      });
    });
});

/**
 * @swagger
 * /api/users/resume:
 *   get:
 *     summary: Get user's resume
 *     tags: [Users]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Resume file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Resume not found
 *       401:
 *         description: Unauthorized
 */
router.get('/resume',
  authMiddleware,
  (req, res) => {
    const userId = req.user.id;
    const filePath = path.join(__dirname, '../../uploads/resumes', `CV_${userId}.pdf`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.sendFile(filePath);
});

module.exports = router; 