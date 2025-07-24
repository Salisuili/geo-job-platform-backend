const express = require('express');
const router = express.Router();

const {
  registerUser,
  loginUser,
  getAllUsers, 
  getUserProfile,
  updateUserProfile,
  getAllLaborers,
  getLaborerProfileAndRatings, 
  upload
} = require('../controllers/userController');

const {
  protect,      
  authorizeRoles 
} = require('../middleware/authMiddleware');


// ====================================================================
// SECTION 1: Public Routes for Authentication
// ====================================================================
router.post('/auth/register', registerUser);
router.post('/auth/login', loginUser);


// ====================================================================
// SECTION 2: User-specific Protected Routes
// ====================================================================

router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, upload.single('profile_picture'), updateUserProfile);



// ====================================================================
// SECTION 3: Laborer-specific Routes
// ====================================================================
router.get('/laborers', getAllLaborers);
router.get('/laborers/:id', getLaborerProfileAndRatings); 


// ====================================================================
// SECTION 4: Admin Routes (This block is now UNCOMMENTED and CORRECTED)
// ====================================================================
router.get('/', protect, authorizeRoles('admin'), getAllUsers); 


module.exports = router;