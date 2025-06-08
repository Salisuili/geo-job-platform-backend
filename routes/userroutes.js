// local-labor-backend/routes/userroutes.js
const express = require('express');
const router = express.Router();
const {
  getAllUsers,      // For admin dashboard
  getUserProfile,   // If you want a specific route for profile (though it's often in authroutes too)
  updateUserProfile, // If you want a specific route for profile update
  getAllLaborers
} = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// Route to get all users (Admin only)
// This will be GET /api/users when mounted in server.js
router.get('/', protect, authorizeRoles('admin'), getAllUsers);

router.get('/laborers', protect, authorizeRoles('employer', 'admin'), getAllLaborers);

// If you want profile routes separate from auth:
// router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);

module.exports = router;