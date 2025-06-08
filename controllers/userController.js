const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const jwt = require('jsonwebtoken'); 
const Rating = require('../models/Rating'); 
const mongoose = require('mongoose'); 

const generateToken = (id, user_type, username, email) => {
  return jwt.sign(
    { _id: id, user_type, username, email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } 
  );
};

// Helper to calculate time ago
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

// @desc      Get a single laborer's profile with aggregated ratings and reviews
// @route     GET /api/laborers/:id
// @access    Public (or Private if all Browse requires login)
const getLaborerProfileAndRatings = asyncHandler(async (req, res) => {
  const laborerId = req.params.id;

  // 1. Get the laborer's basic profile
  const laborer = await User.findById(laborerId).select('-password'); // Exclude password
  if (!laborer || laborer.user_type !== 'laborer') {
    res.status(404);
    throw new Error('Laborer not found or not a laborer user type.');
  }

  // 2. Get all ratings/reviews where the target_id is this laborer
  const reviews = await Rating.find({ target_id: laborerId })
    .populate('rater_id', 'full_name profile_picture_url') // Populate the rater's details
    .sort({ createdAt: -1 }); // Latest reviews first

  // 3. Aggregate ratings data
  let overallRating = 0;
  let totalReviews = reviews.length;
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  if (totalReviews > 0) {
    let sumOfStars = 0;
    reviews.forEach(review => {
      sumOfStars += review.rating; // Use review.rating (from your model)
      if (review.rating >= 1 && review.rating <= 5) {
        ratingDistribution[review.rating]++;
      }
    });
    overallRating = sumOfStars / totalReviews;
  }

  // Convert distribution to percentages (sorted 5 to 1 stars for display)
  const distributionArray = Object.keys(ratingDistribution).sort((a, b) => b - a).map(star => {
    const count = ratingDistribution[star];
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    return { stars: parseInt(star), count, percentage: parseFloat(percentage.toFixed(1)) };
  });

  // Prepare reviews for frontend, matching expected structure
  const formattedReviews = reviews.map(review => ({
    _id: review._id, // Use _id for key in React
    reviewer: { // Map rater_id to reviewer for frontend consistency
      _id: review.rater_id?._id,
      full_name: review.rater_id?.full_name || 'Anonymous',
      profile_picture_url: review.rater_id?.profile_picture_url || 'https://via.placeholder.com/40x40?text=NA',
    },
    rating: review.rating, // Use review.rating as passed by your model
    comment: review.comment, // Use review.comment as passed by your model
    likes: review.likes || 0, // Default to 0 if not present in your Rating model
    dislikes: review.dislikes || 0, // Default to 0 if not present in your Rating model
    timeAgo: timeAgo(review.createdAt), // Use the helper function
    createdAt: review.createdAt,
  }));

  // Construct the final data object for the frontend
  const laborerProfileData = {
    _id: laborer._id,
    full_name: laborer.full_name,
    username: laborer.username,
    email: laborer.email,
    profile_picture_url: laborer.profile_picture_url,
    bio: laborer.bio,
    hourly_rate: laborer.hourly_rate,
    is_available: laborer.is_available,
    skills: laborer.skills,
    current_location: laborer.current_location,
    // Extract year from createdAt for "Joined in"
    joinedDate: laborer.createdAt ? new Date(laborer.createdAt).getFullYear().toString() : 'N/A',
    overallRating: overallRating, // Frontend will format to fixed(1)
    totalReviews: totalReviews,
    ratingDistribution: distributionArray,
    reviews: formattedReviews,
  };

  res.status(200).json({ laborer: laborerProfileData });
});


// @desc      Get all laborer users WITH their aggregated ratings
// @route     GET /api/users/laborers
// @access    Private/Employer, Private/Admin (or just Private/Employer if preferred)
const getAllLaborers = asyncHandler(async (req, res) => {
  const laborers = await User.aggregate([
    // Stage 1: Match only users with user_type 'laborer'
    {
      $match: {
        user_type: 'laborer',
      },
    },
    // Stage 2: Left Join with the 'ratings' collection
    {
      $lookup: {
        from: 'ratings', // The name of your ratings collection (usually plural, lowercase of model name)
        localField: '_id', // Field from the User model (laborer's ID)
        foreignField: 'target_id', // Field from the Rating model (who was rated)
        as: 'ratings', // The array field to add to the input documents
      },
    },
    // Stage 3: Project to include original fields and calculate ratings
    {
      $project: {
        _id: 1,
        username: 1,
        email: 1,
        full_name: 1,
        user_type: 1,
        profile_picture_url: 1,
        bio: 1,
        hourly_rate: 1,
        is_available: 1,
        skills: 1,
        current_location: 1,
        createdAt: 1, // Keep original creation date if needed
        // Calculate overallRating
        overallRating: { $avg: '$ratings.rating' }, // Average of the 'rating' field within the 'ratings' array
        // Calculate totalReviews
        totalReviews: { $size: '$ratings' }, // Count the number of items in the 'ratings' array
      },
    },
    // Optional Stage 4: Add a field to format overallRating to 1 decimal place
    // This is good for sending it directly formatted to the frontend,
    // otherwise the frontend can format it with .toFixed(1)
    {
      $addFields: {
        overallRating: {
          $cond: {
            if: { $ne: ['$totalReviews', 0] }, // If there are reviews
            then: { $round: ['$overallRating', 1] }, // Round to 1 decimal place
            else: 0, // If no reviews, set to 0
          },
        },
      },
    },
  ]);

  res.status(200).json(laborers);
});


// @desc      Register a new user
// @route     POST /api/auth/register
// @access    Public
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, full_name, user_type, phone_number, bio, hourly_rate, skills, company_name, company_description } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ $or: [{ email }, { username }] });
  if (userExists) {
    res.status(400);
    throw new Error('User with this email or username already exists');
  }

  // Prepare user data based on user_type
  const userData = { username, email, password, full_name, user_type };
  if (phone_number) userData.phone_number = phone_number;

  if (user_type === 'laborer') {
    userData.bio = bio;
    userData.hourly_rate = hourly_rate;
    userData.skills = skills; // Expecting an array from frontend or comma-separated string handled by frontend
  } else if (user_type === 'employer') {
    userData.company_name = company_name;
    userData.company_description = company_description;
  }
  // Add other common fields here if needed

  const user = await User.create(userData);

  if (user) {
    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      user_type: user.user_type,
      profile_picture_url: user.profile_picture_url,
      token: generateToken(user._id, user.user_type, user.username, user.email),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc      Authenticate user & get token
// @route     POST /api/auth/login
// @access    Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check if user exists by email (or username, if you modify the schema and query)
  const user = await User.findOne({ email });

  // Check password
  if (user && (await user.comparePassword(password))) {
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      user_type: user.user_type,
      profile_picture_url: user.profile_picture_url,
      token: generateToken(user._id, user.user_type, user.username, user.email),
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc      Get all users (Admin only)
// @route     GET /api/users
// @access    Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password'); // Fetch all users, exclude password for security

  res.status(200).json(users);
});

// @desc      Get user profile (for logged-in user)
// @route     GET /api/users/profile
// @access    Private
const getUserProfile = asyncHandler(async (req, res) => {
  // req.user is set by the protect middleware
  const user = await User.findById(req.user._id).select('-password');

  if (user) {
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      user_type: user.user_type,
      phone_number: user.phone_number,
      profile_picture_url: user.profile_picture_url,
      bio: user.bio,
      hourly_rate: user.hourly_rate,
      skills: user.skills,
      company_name: user.company_name,
      company_description: user.company_description,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc      Update user profile
// @route     PUT /api/users/profile
// @access    Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.full_name = req.body.full_name || user.full_name;
    user.email = req.body.email || user.email;
    user.phone_number = req.body.phone_number || user.phone_number;
    user.profile_picture_url = req.body.profile_picture_url || user.profile_picture_url;
    // Add conditional updates based on user_type
    if (user.user_type === 'laborer') {
      user.bio = req.body.bio || user.bio;
      user.hourly_rate = req.body.hourly_rate || user.hourly_rate;
      user.skills = req.body.skills || user.skills;
      user.is_available = req.body.is_available !== undefined ? req.body.is_available : user.is_available;
    } else if (user.user_type === 'employer') {
      user.company_name = req.body.company_name || user.company_name;
      user.company_description = req.body.company_description || user.company_description;
    }

    // Only update password if new password is provided
    if (req.body.password) {
      user.password = req.body.password; // Mongoose pre-save hook will hash this
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      full_name: updatedUser.full_name,
      user_type: updatedUser.user_type,
      profile_picture_url: updatedUser.profile_picture_url,
      token: generateToken(updatedUser._id, updatedUser.user_type, updatedUser.username, updatedUser.email),
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});


module.exports = {
  registerUser,
  loginUser,
  getAllUsers,
  getUserProfile,
  updateUserProfile,
  getAllLaborers,
  getLaborerProfileAndRatings, // <--- Export the new function
};