const express = require('express');
const router = express.Router();
const authMiddleware = require('../apis/authMiddleware');
const { Feedback } = require('../models');
const checkRole = require('../middleware/checkRole');

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Submit feedback (Participant only)
 *     tags: [Feedback]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - sentiment
 *             properties:
 *               content:
 *                 type: string
 *               sentiment:
 *                 type: string
 *                 enum: [positive, negative, neutral]
 */
router.post('/',
  authMiddleware,
  checkRole('Participant'),
  async (req, res) => {
    try {
      const { content, sentiment } = req.body;

      // Validate sentiment
      if (!['positive', 'negative', 'neutral'].includes(sentiment)) {
        return res.status(400).json({
          error: 'Invalid sentiment value. Must be positive, negative, or neutral'
        });
      }

      // Create feedback
      const feedback = await Feedback.create({
        content,
        sentiment
      });

      res.json({
        success: true,
        message: 'Feedback submitted successfully',
        feedback
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: Get all feedback (Admin only)
 *     tags: [Feedback]
 *     security:
 *       - sessionAuth: []
 */
router.get('/',
  authMiddleware,
  checkRole(['Admin']),
  async (req, res) => {
    try {
      const feedback = await Feedback.findAll({
        order: [['createdAt', 'DESC']]
      });

      res.json(feedback);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

module.exports = router; 