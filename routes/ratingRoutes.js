// local-labor-backend/routes/ratingroutes.js
const express = require('express');
const router = express.Router();
const {
  createRating,
  getRatingsForUser,
  getAverageRatingForUser,
  getRatingsForJob,
} = require('../controllers/ratingController'); // Import from controller
const { protect } = require('../middleware/authMiddleware'); // Import middleware

// Routes for ratings
router.post('/', protect, createRating); // Create a rating (protected)

router.get('/user/:targetId', getRatingsForUser); // Get all ratings for a user (public)
router.get('/user/:targetId/average', getAverageRatingForUser); // Get average rating for a user (public)
router.get('/job/:jobId', getRatingsForJob); // Get all ratings for a job (public)

module.exports = router;