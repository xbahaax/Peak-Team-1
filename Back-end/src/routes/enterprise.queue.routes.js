const express = require('express');
const router = express.Router();
const authMiddleware = require('../apis/authMiddleware');
const checkRole = require('../middleware/checkRole');
const { StandQueue, QueueEntry, User, ParticipantResume, Feedback } = require('../models');
const { Op } = require('sequelize');

/**
 * @swagger
 * /api/enterprise/queue:
 *   get:
 *     summary: Get enterprise queue status and participant details (Enterprise only)
 *     tags: [Enterprise]
 *     security:
 *       - sessionAuth: []
 */
router.get('/queue',
  authMiddleware,
  checkRole(['Enterprise']),
  async (req, res) => {
    try {
      const queue = await StandQueue.findOne({
        where: { enterpriseId: req.user.id },
        include: [{
          model: QueueEntry,
          where: {
            status: {
              [Op.in]: ['Waiting', 'Active']
            }
          },
          include: [{
            model: User,
            attributes: ['id', 'username'],
            include: [{
              model: ParticipantResume,
              attributes: ['id', 'fileName', 'uploadedAt']
            }]
          }],
          required: false
        }]
      });

      if (!queue) {
        return res.status(404).json({ error: 'Queue not found for this enterprise' });
      }

      res.json(queue);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/enterprise/queue/participant/{participantId}/resume:
 *   get:
 *     summary: Get participant resume (Enterprise only)
 *     tags: [Enterprise]
 *     security:
 *       - sessionAuth: []
 */
router.get('/queue/participant/:participantId/resume',
  authMiddleware,
  checkRole(['Enterprise']),
  async (req, res) => {
    try {
      // First verify this participant is in the enterprise's queue
      const queueEntry = await QueueEntry.findOne({
        where: {
          userId: req.params.participantId
        },
        include: [{
          model: StandQueue,
          where: { enterpriseId: req.user.id }
        }]
      });

      if (!queueEntry) {
        return res.status(403).json({ 
          error: 'Unauthorized. Participant not in queue' 
        });
      }

      const resume = await ParticipantResume.findOne({
        where: { userId: req.params.participantId }
      });

      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      res.download(resume.filePath, resume.fileName);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/enterprise/queue/{enterpriseId}/join:
 *   post:
 *     summary: Join an enterprise queue (Participant only)
 *     tags: [Enterprise Queue]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: enterpriseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully joined queue
 *       400:
 *         description: Queue is full or user already in queue
 */
router.post('/:enterpriseId/join',
  authMiddleware,
  checkRole('Participant'),
  async (req, res) => {
    try {
      const { enterpriseId } = req.params;

      // Check if user is already in any active queue
      const existingEntry = await QueueEntry.findOne({
        where: {
          userId: req.user.id,
          status: 'Active'
        }
      });

      if (existingEntry) {
        return res.status(400).json({
          error: 'You are already in an active queue'
        });
      }

      // Get or create queue for this enterprise
      let [standQueue] = await StandQueue.findOrCreate({
        where: { enterpriseId },
        defaults: {
          status: 'Open',
          currentParticipants: 0
        }
      });

      // Check if queue is full (max 2 concurrent participants)
      if (standQueue.currentParticipants >= 2) {
        return res.status(400).json({
          error: 'Queue is full (maximum 2 concurrent participants)'
        });
      }

      // Create queue entry
      const queueEntry = await QueueEntry.create({
        userId: req.user.id,
        standQueueId: standQueue.id,
        status: 'Active'
      });

      // Update queue count
      await standQueue.update({
        currentParticipants: standQueue.currentParticipants + 1
      });

      res.json({
        success: true,
        message: 'Successfully joined queue',
        queueEntry
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/enterprise/queue/{enterpriseId}/leave:
 *   post:
 *     summary: Leave an enterprise queue (Participant only)
 *     tags: [Enterprise Queue]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: enterpriseId
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/:enterpriseId/leave',
  authMiddleware,
  checkRole('Participant'),
  async (req, res) => {
    try {
      const { enterpriseId } = req.params;

      // Find user's queue entry
      const queueEntry = await QueueEntry.findOne({
        where: {
          userId: req.user.id,
          status: 'Active'
        },
        include: [{
          model: StandQueue,
          where: { enterpriseId }
        }]
      });

      if (!queueEntry) {
        return res.status(404).json({
          error: 'You are not in this queue'
        });
      }

      // Update queue entry status
      await queueEntry.update({ status: 'Left' });

      // Update queue count
      await queueEntry.StandQueue.update({
        currentParticipants: Math.max(0, queueEntry.StandQueue.currentParticipants - 1)
      });

      res.json({
        success: true,
        message: 'Successfully left queue'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

module.exports = router; 