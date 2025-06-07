// local-labor-backend/routes/authroutes.js
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getAllUsers, // Import from controller
  getUserProfile, // Import from controller
  updateUserProfile, // Import from controller
} = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware'); // Import middleware

// Public authentication routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// User profile routes (protected)
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);

module.exports = router;