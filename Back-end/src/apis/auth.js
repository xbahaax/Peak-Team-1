const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../models/user');
const Session = require('../models/session');

class Auth {
  static async hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  static async verifyPassword(password, hash, salt) {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  static async register(username, password, role) {
    // Check if username already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Hash password
    const { hash, salt } = await Auth.hashPassword(password);

    // Create new user
    const user = await User.create({
      username,
      passwordHash: hash,
      salt,
      role
    });

    return user.id;
  }

  static async login(username, password) {
    // Find user
    const user = await User.findOne({ where: { username } });
    if (!user) {
      throw new Error('Invalid username or password');
    }

    // Verify password
    const isValid = await Auth.verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      throw new Error('Invalid username or password');
    }

    // Clean up expired sessions
    await Session.destroy({
      where: {
        expiresAt: { [Op.lt]: new Date() }
      }
    });

    // Create new session
    const session = await Session.create({
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    return {
      sessionId: session.id,
      sessionCookie: {
        name: 'sessionId',
        value: session.id,
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          path: '/'
        }
      },
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    };
  }

  static async logout(sessionId) {
    await Session.destroy({
      where: { id: sessionId }
    });
  }

  static async changeUserRole(userId, newRole) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.role = newRole;
    await user.save();
  }

  static async validateSession(sessionId) {
    // Find session
    const session = await Session.findByPk(sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await session.destroy();
      throw new Error('Session expired');
    }

    // Find user
    const user = await User.findByPk(session.userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role
    };
  }
}

module.exports = Auth; 