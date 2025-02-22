const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const StandQueue = sequelize.define('StandQueue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  enterpriseId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Open', 'Full', 'Closed'),
    defaultValue: 'Open'
  },
  currentParticipants: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 4
    }
  },
  totalProcessed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

module.exports = StandQueue; 