const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');
const StandQueue = require('./standQueue');

const QueueEntry = sequelize.define('QueueEntry', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  status: {
    type: DataTypes.ENUM('Waiting', 'Active', 'Completed', 'Cancelled'),
    defaultValue: 'Waiting'
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  startedAt: {
    type: DataTypes.DATE
  },
  completedAt: {
    type: DataTypes.DATE
  }
});

// Associations
QueueEntry.belongsTo(User);
QueueEntry.belongsTo(StandQueue);

module.exports = QueueEntry; 