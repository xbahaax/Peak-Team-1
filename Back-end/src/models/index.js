const User = require('./user');
const Session = require('./session');
const StandQueue = require('./standQueue');
const QueueEntry = require('./queueEntry');
const ParticipantResume = require('./participantResume');
const Feedback = require('./feedback');

// Define additional relationships here
StandQueue.hasMany(QueueEntry);
User.hasMany(QueueEntry);
User.hasMany(Session);
User.hasOne(ParticipantResume);
ParticipantResume.belongsTo(User);

module.exports = {
  User,
  Session,
  StandQueue,
  QueueEntry,
  ParticipantResume,
  Feedback
}; 