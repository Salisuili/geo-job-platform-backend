const jwt = require('jsonwebtoken');
const User = require('../models/User'); 

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET); 
      req.user = await User.findById(decoded._id).select('-password');
      next(); 
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    console.log('Backend Auth Middleware: Authorization header missing or malformed.');
  }

  if (!token) {
    
    res.status(401).json({ message: 'Not authorized, no token' });
    return; 
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.user_type)) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource.' });
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };