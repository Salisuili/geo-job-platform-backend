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
  upload, // Multer upload middleware
  updateUserLocation // <-- NEW: Function to handle location update
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
  // CORRECTED: Changed 'profile_picture' to 'profileImage' to match frontend FormData
  .put(protect, upload.single('profile_picture'), updateUserProfile);

// NEW ROUTE: Endpoint for updating user location and city based on coordinates
// The front-end calls PUT /api/users/:id/location. Since this router is mounted at /api/users, the path is /:id/location
router.put('/:id/location', protect, updateUserLocation);


// ====================================================================
// SECTION 3: Laborer-specific Routes
// ====================================================================
router.get('/laborers', getAllLaborers);
router.get('/laborers/:id', getLaborerProfileAndRatings);


// ====================================================================
// SECTION 4: Admin Routes
// ====================================================================
router.get('/', protect, authorizeRoles('admin'), getAllUsers);


module.exports = router;
