// local-labor-backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Import User model

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // This is likely line 14

      // Attach user to the request object (without password)
      req.user = await User.findById(decoded._id).select('-password');
      next(); // Proceed to the next middleware/route handler
    } catch (error) {
      // Log the specific error message from jsonwebtoken
      console.error('Backend Auth Middleware Error: Token verification failed:', error.message);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    // This logs if the header is missing or doesn't start with 'Bearer'
    console.log('Backend Auth Middleware: Authorization header missing or malformed.');
  }

  if (!token) {
    console.log('Backend Auth Middleware: No token found or extracted. Sending 401.');
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