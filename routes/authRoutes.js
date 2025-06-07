const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getAllUsers, 
  getUserProfile, 
  updateUserProfile, 
} = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware'); 

router.post('/register', registerUser);
router.post('/login', loginUser);

router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);

module.exports = router;