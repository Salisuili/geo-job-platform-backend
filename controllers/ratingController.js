// local-labor-backend/controllers/ratingController.js
const Rating = require('../models/Rating');
const User = require('../models/User'); // To validate target_id
const Job = require('../models/Job'); // To validate job_id (optional)
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Create a new rating
// @route   POST /api/ratings
// @access  Private (only logged-in users can rate)
const createRating = asyncHandler(async (req, res) => {
  const { target_id, job_id, rating, comment } = req.body;
  const rater_id = req.user._id; // The rater is the authenticated user

  // Basic validation
  if (!target_id || !rating) {
    res.status(400);
    throw new Error('Target user and rating are required.');
  }
  if (rating < 1 || rating > 5) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5.');
  }

  // Ensure rater is not rating themselves
  if (rater_id.toString() === target_id.toString()) {
    res.status(400);
    throw new Error('Cannot rate yourself.');
  }

  // Check if target user exists
  const targetUser = await User.findById(target_id);
  if (!targetUser) {
    res.status(404);
    throw new Error('Target user not found.');
  }

  // Check if job exists if job_id is provided
  if (job_id) {
    const job = await Job.findById(job_id);
    if (!job) {
      res.status(404);
      throw new Error('Associated job not found.');
    }
  }

  const newRating = await Rating.create({
    rater_id,
    target_id,
    job_id,
    rating,
    comment,
  });

  res.status(201).json(newRating);
});

// @desc    Get all ratings for a specific user (target_id)
// @route   GET /api/ratings/user/:targetId
// @access  Public
const getRatingsForUser = asyncHandler(async (req, res) => {
  const ratings = await Rating.find({ target_id: req.params.targetId })
                              .populate('rater_id', 'full_name profile_picture_url user_type') // Show who rated
                              .populate('job_id', 'title'); // Show which job it was for

  if (!ratings || ratings.length === 0) {
    // You might want to return an empty array instead of 404 if no ratings is a valid state
    return res.status(200).json([]);
  }
  res.status(200).json(ratings);
});

// @desc    Get average rating and total count for a specific user (target_id)
// @route   GET /api/ratings/user/:targetId/average
// @access  Public
const getAverageRatingForUser = asyncHandler(async (req, res) => {
    const result = await Rating.aggregate([
        { $match: { target_id: new mongoose.Types.ObjectId(req.params.targetId) } },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalRatings: { $sum: 1 }
            }
        }
    ]);

    if (result.length > 0) {
        res.status(200).json({
            averageRating: parseFloat(result[0].averageRating.toFixed(1)), // Format to 1 decimal place
            totalRatings: result[0].totalRatings
        });
    } else {
        res.status(200).json({ averageRating: 0, totalRatings: 0 }); // No ratings yet
    }
});


// @desc    Get ratings for a specific job (job_id) - less common
// @route   GET /api/ratings/job/:jobId
// @access  Public
const getRatingsForJob = asyncHandler(async (req, res) => {
  const ratings = await Rating.find({ job_id: req.params.jobId })
                              .populate('rater_id', 'full_name profile_picture_url user_type');
  res.status(200).json(ratings);
});

module.exports = {
  createRating,
  getRatingsForUser,
  getAverageRatingForUser,
  getRatingsForJob,
};