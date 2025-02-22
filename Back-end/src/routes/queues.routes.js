const express = require('express');
const router = express.Router();
const authMiddleware = require('../apis/authMiddleware');
const { StandQueue, QueueEntry } = require('../models');
const { Op } = require('sequelize');
const checkRole = require('../middleware/checkRole');

/**
 * @swagger
 * /api/queues/stand:
 *   post:
 *     summary: Create or update a stand queue (Organizer only)
 *     tags: [Queues]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enterpriseId
 *             properties:
 *               enterpriseId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [Open, Full, Closed]
 *               currentParticipants:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 4
 */
router.post('/stand', 
  authMiddleware,
  checkRole(['Admin', 'Organizer']),
  async (req, res) => {
    try {
      const { enterpriseId, status, currentParticipants } = req.body;
      
      let standQueue = await StandQueue.findOne({ where: { enterpriseId } });
      
      if (standQueue) {
        standQueue = await standQueue.update({
          status,
          currentParticipants
        });
      } else {
        standQueue = await StandQueue.create({
          enterpriseId,
          status,
          currentParticipants
        });
      }

      res.json(standQueue);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queues/join:
 *   post:
 *     summary: Join a stand queue (Participant only)
 *     tags: [Queues]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enterpriseId
 *             properties:
 *               enterpriseId:
 *                 type: string
 */
router.post('/join',
  authMiddleware,
  checkRole(['Participant']),
  async (req, res) => {
    try {
      const { enterpriseId } = req.body;
      
      // Check if participant is already in 2 queues
      const activeQueues = await QueueEntry.count({
        where: {
          userId: req.user.id,
          status: {
            [Op.in]: ['Waiting', 'Active']
          }
        }
      });

      if (activeQueues >= 2) {
        return res.status(400).json({
          error: 'You can only be in 2 queues at a time'
        });
      }

      // Check stand queue status
      const standQueue = await StandQueue.findOne({
        where: { enterpriseId }
      });

      if (!standQueue || standQueue.status === 'Closed') {
        return res.status(400).json({
          error: 'This stand queue is not available'
        });
      }

      if (standQueue.status === 'Full' && standQueue.currentParticipants >= 4) {
        return res.status(400).json({
          error: 'This stand queue is full'
        });
      }

      // Create queue entry
      const queueEntry = await QueueEntry.create({
        userId: req.user.id,
        standQueueId: standQueue.id
      });

      res.json(queueEntry);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queues/{queueId}/complete:
 *   post:
 *     summary: Mark a stand queue as completed (Organizer only)
 *     tags: [Queues]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/:queueId/complete',
  authMiddleware,
  checkRole(['Admin', 'Organizer']),
  async (req, res) => {
    try {
      const entry = await QueueEntry.findByPk(req.params.queueId);
      if (!entry) {
        return res.status(404).json({ error: 'Queue entry not found' });
      }

      const standQueue = await StandQueue.findByPk(entry.standQueueId);
      
      await entry.update({
        status: 'Completed',
        completedAt: new Date()
      });

      await standQueue.update({
        currentParticipants: Math.max(0, standQueue.currentParticipants - 1),
        totalProcessed: standQueue.totalProcessed + 1
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queues/{queueId}/uncomplete:
 *   post:
 *     summary: Remove completed state from a queue entry (Organizer only)
 *     tags: [Queues]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/:queueId/uncomplete',
  authMiddleware,
  checkRole(['Admin', 'Organizer']),
  async (req, res) => {
    try {
      const entry = await QueueEntry.findByPk(req.params.queueId);
      if (!entry) {
        return res.status(404).json({ error: 'Queue entry not found' });
      }

      const standQueue = await StandQueue.findByPk(entry.standQueueId);
      
      await entry.update({
        status: 'Active',
        completedAt: null
      });

      await standQueue.update({
        currentParticipants: standQueue.currentParticipants + 1,
        totalProcessed: Math.max(0, standQueue.totalProcessed - 1)
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queues/status:
 *   get:
 *     summary: Get queue status for all stands
 *     tags: [Queues]
 *     security:
 *       - sessionAuth: []
 */
router.get('/status',
  authMiddleware,
  async (req, res) => {
    try {
      const queues = await StandQueue.findAll({
        include: [{
          model: QueueEntry,
          where: {
            status: {
              [Op.in]: ['Waiting', 'Active']
            }
          },
          required: false
        }]
      });

      res.json(queues);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

module.exports = router; 