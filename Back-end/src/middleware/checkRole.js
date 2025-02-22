const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // Check if user exists in request (should be set by auth middleware)
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if user's role is in the allowed roles array
    if (Array.isArray(allowedRoles) && allowedRoles.includes(req.user.role)) {
      next();
    } else if (typeof allowedRoles === 'string' && req.user.role === allowedRoles) {
      next();
    } else {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
  };
};

module.exports = checkRole; 