const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Feedback = sequelize.define('Feedback', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  sentiment: {
    type: DataTypes.ENUM('positive', 'negative', 'neutral'),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('event', 'platform', 'other'),
    allowNull: false,
    defaultValue: 'other'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
});

module.exports = Feedback; 