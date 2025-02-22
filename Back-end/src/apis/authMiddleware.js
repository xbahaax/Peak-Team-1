const Session = require('../models/session');
const User = require('../models/user');

async function authMiddleware(req, res, next) {
  const sessionId = req.headers.cookie?.split('; ').find(row => row.startsWith('sessionId='))?.split('=')[1];
  
  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }

  try {
    const session = await Session.findOne({ 
      where: { id: sessionId },
      include: User
    });
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    if (new Date(session.expiresAt) < new Date()) {
      await session.destroy();
      return res.status(401).json({ error: 'Session expired' });
    }
    
    req.user = session.User;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = authMiddleware; 