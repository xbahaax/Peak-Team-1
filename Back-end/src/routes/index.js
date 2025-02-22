const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const contactsRoutes = require('./contacts.routes');
const enterpriseRoutes = require('./enterprise.routes');
const enterpriseQueueRoutes = require('./enterprise.queue.routes');
const queuesRoutes = require('./queues.routes');
const userRoutes = require('./user.routes');
const feedbackRoutes = require('./feedback.routes');

// Mount routes with their base paths
router.use('/auth', authRoutes);
router.use('/contacts', contactsRoutes);
router.use('/enterprise', enterpriseRoutes);
router.use('/enterprise/queue', enterpriseQueueRoutes);
router.use('/queues', queuesRoutes);
router.use('/users', userRoutes);
router.use('/feedback', feedbackRoutes);

// Basic health check route
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router; 