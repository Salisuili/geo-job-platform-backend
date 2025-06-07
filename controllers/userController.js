// local-labor-backend/controllers/userController.js
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const jwt = require('jsonwebtoken'); // Needed for login to generate token

// Helper function to generate a JWT token (similar to what's in User model)
const generateToken = (id, user_type, username, email) => {
  return jwt.sign(
    { _id: id, user_type, username, email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // Token expires in 1 hour
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
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

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
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

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password'); // Fetch all users, exclude password for security

  res.status(200).json(users);
});

// @desc    Get user profile (for logged-in user)
// @route   GET /api/users/profile
// @access  Private
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

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
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
};