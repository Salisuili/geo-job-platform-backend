// local-labor-backend/controllers/jobController.js
const Job = require('../models/Job');
const asyncHandler = require('../middleware/asyncHandler');
// Optional: If you want to use a geocoding service to convert address to coordinates
// const NodeGeocoder = require('node-geocoder');

// const options = {
//   provider: 'google', // e.g., 'google', 'openstreetmap', 'mapbox'
//   apiKey: 'YOUR_GOOGLE_GEOCODING_API_KEY', // For Google, Mapbox etc.
//   formatter: null // 'gpx', 'string', ...
// };
// const geocoder = NodeGeocoder(options);

// @desc    Create a new job posting
// @route   POST /api/jobs
// @access  Private (Employer/Admin only)
const createJob = asyncHandler(async (req, res) => {
  const { title, description, job_type, location, address_text, pay_rate_min, pay_rate_max, pay_type, application_deadline, required_skills, image_url } = req.body;

  // Basic validation
  if (!title || !description || !job_type || !location || !address_text || !pay_rate_min || !pay_rate_max || !pay_type) {
    res.status(400);
    throw new Error('Please fill in all required job fields');
  }

  // Validate location format (GeoJSON Point)
  if (!location.type || location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    res.status(400);
    throw new Error('Location must be a GeoJSON Point with [longitude, latitude] coordinates.');
  }

  // Optional: Convert address_text to coordinates if frontend only sends address
  // try {
  //   const geoResults = await geocoder.geocode(address_text);
  //   if (geoResults && geoResults.length > 0) {
  //     location.coordinates = [geoResults[0].longitude, geoResults[0].latitude];
  //   } else {
  //     // Handle case where geocoding fails, maybe still proceed with provided lat/long or throw error
  //     console.warn('Geocoding failed for address:', address_text);
  //   }
  // } catch (geoError) {
  //   console.error('Geocoding service error:', geoError);
  //   // You might want to handle this error or let the job be created with manual coordinates
  // }

  const job = await Job.create({
    employer_id: req.user._id, // Employer ID from authenticated user
    title,
    description,
    job_type,
    location, // GeoJSON Point object with coordinates
    address_text, // Human-readable address
    pay_rate_min,
    pay_rate_max,
    pay_type,
    application_deadline,
    required_skills,
    image_url,
    status: 'Active', // Default status
  });

  res.status(201).json(job);
});

// @desc    Get all job postings (for homepage, employer's jobs, admin dashboard)
// @route   GET /api/jobs
// @access  Public (can be protected if all job viewing requires login)
const getAllJobs = asyncHandler(async (req, res) => {
  // For Admin Dashboard, you might just want all jobs.
  // For other uses (e.g., public homepage, or specific employer's jobs),
  // you'd add query parameters here.
  let query = {};
  if (req.query.employerId) {
    query.employer_id = req.query.employerId; // Filter by specific employer
  }
  if (req.query.status) {
    query.status = req.query.status; // Filter by job status
  }
  // Add other filters like location (for geospatial queries), job_type, skills etc.

  // Geospatial query example:
  // if (req.query.long && req.query.lat && req.query.maxDistance) {
  //   query.location = {
  //     $nearSphere: {
  //       $geometry: {
  //         type: "Point",
  //         coordinates: [parseFloat(req.query.long), parseFloat(req.query.lat)]
  //       },
  //       $maxDistance: parseInt(req.query.maxDistance) // distance in meters
  //     }
  //   };
  // }


  const jobs = await Job.find(query)
                        .populate('employer_id', 'full_name company_name email profile_picture_url'); // Populate employer details

  res.status(200).json(jobs);
});

// @desc    Get a single job by ID
// @route   GET /api/jobs/:id
// @access  Public (or Private depending on app logic)
const getJobById = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id)
                        .populate('employer_id', 'full_name company_name email profile_picture_url');

  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }

  res.status(200).json(job);
});

// @desc    Update a job posting
// @route   PUT /api/jobs/:id
// @access  Private (Employer who posted the job or Admin)
const updateJob = asyncHandler(async (req, res) => {
  const { title, description, job_type, location, address_text, pay_rate_min, pay_rate_max, pay_type, application_deadline, required_skills, image_url, status } = req.body;

  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }

  // Ensure the logged-in user is the employer who posted this job OR is an admin
  if (req.user.user_type !== 'admin' && job.employer_id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to update this job');
  }

  // Update fields
  job.title = title || job.title;
  job.description = description || job.description;
  job.job_type = job_type || job.job_type;
  job.location = location || job.location; // Expecting GeoJSON Point
  job.address_text = address_text || job.address_text;
  job.pay_rate_min = pay_rate_min !== undefined ? pay_rate_min : job.pay_rate_min;
  job.pay_rate_max = pay_rate_max !== undefined ? pay_rate_max : job.pay_rate_max;
  job.pay_type = pay_type || job.pay_type;
  job.application_deadline = application_deadline || job.application_deadline;
  job.required_skills = required_skills || job.required_skills;
  job.image_url = image_url || job.image_url;
  job.status = status || job.status;

  const updatedJob = await job.save();

  res.status(200).json(updatedJob);
});

// @desc    Delete a job posting
// @route   DELETE /api/jobs/:id
// @access  Private (Employer who posted the job or Admin)
const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error('Job not found');
  }

  // Ensure the logged-in user is the employer who posted this job OR is an admin
  if (req.user.user_type !== 'admin' && job.employer_id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this job');
  }

  await job.deleteOne(); // Use deleteOne on the document instance
  res.status(200).json({ message: 'Job removed successfully' });
});


// @desc    Get jobs posted by the authenticated employer
// @route   GET /api/jobs/my-jobs
// @access  Private (Employer)

const getEmployerJobs = asyncHandler(async (req, res) => {
  // The 'req.user' object is available due to the 'protect' middleware
  // It contains the logged-in user's ID
  const employerId = req.user._id;

  const jobs = await Job.find({ employer_id: employerId })
                        .sort({ createdAt: -1 }); // Sort by most recent first

  if (jobs) {
    res.status(200).json(jobs);
  } else {
    res.status(404).json({ message: 'No jobs found for this employer.' });
  }
});

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getEmployerJobs,
};