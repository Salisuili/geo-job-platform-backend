const Job = require('../models/Job');
const asyncHandler = require('../middleware/asyncHandler');
const NodeGeocoder = require('node-geocoder');

// Configure Node Geocoder for OpenStreetMap Nominatim
const options = {
  provider: 'openstreetmap', 
  formatter: null
};
const geocoder = NodeGeocoder(options);


// @desc    Create a new job posting
// @route   POST /api/jobs
// @access  Private (Employer/Admin only)
const createJob = asyncHandler(async (req, res) => {
  const { title, description, job_type, city, pay_rate_min, pay_rate_max, pay_type, application_deadline, required_skills, image_url } = req.body;

  if (!title || !description || !job_type || !city || !pay_rate_min || !pay_rate_max || !pay_type) {
    res.status(400);
    throw new Error('Please fill in all required job fields (title, description, job type, city, pay rates, pay type).');
  }

  let geoCoordinates;
  try {
    const geoResults = await geocoder.geocode(city);

    if (geoResults && geoResults.length > 0) {
      // Nominatim returns [latitude, longitude] in the result object,
      // but GeoJSON Point requires [longitude, latitude]
      geoCoordinates = [geoResults[0].longitude, geoResults[0].latitude];
    } else {
      res.status(400);
      throw new Error(`Could not find coordinates for the city: "${city}". Please enter a valid city.`);
    }
  } catch (geoError) {
    console.error('Geocoding service error:', geoError);
    res.status(500);
    throw new Error('Error processing job location. Please try again later or verify the city.');
  }

  const location = {
    type: "Point",
    coordinates: geoCoordinates
  };

  const job = await Job.create({
    employer_id: req.user._id,
    title,
    description,
    job_type,
    city,
    location,
    pay_rate_min,
    pay_rate_max,
    pay_type,
    application_deadline,
    required_skills,
    image_url,
    status: 'Active',
  });

  res.status(201).json(job);
});

// @desc    Get all job postings
const getAllJobs = asyncHandler(async (req, res) => {
  let query = {};
  if (req.query.employerId) { query.employer_id = req.query.employerId; }
  if (req.query.status) { query.status = req.query.status; }
  if (req.query.jobType) { query.job_type = req.query.jobType; }
  if (req.query.skills) {
    const skillsArray = req.query.skills.split(',').map(s => new RegExp(s.trim(), 'i'));
    query.required_skills = { $in: skillsArray };
  }
  if (req.query.city) {
    query.city = new RegExp(req.query.city, 'i');
  }

  if (req.query.long && req.query.lat && req.query.maxDistance) {
    query.location = {
      $nearSphere: {
        $geometry: {
          type: "Point",
          coordinates: [parseFloat(req.query.long), parseFloat(req.query.lat)]
        },
        $maxDistance: parseInt(req.query.maxDistance)
      }
    };
  }

  const jobs = await Job.find(query)
                        .populate('employer_id', 'full_name company_name email profile_picture_url');

  res.status(200).json(jobs);
});

// @desc    Get a single job by ID
const getJobById = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id)
                        .populate('employer_id', 'full_name company_name email profile_picture_url');
  if (!job) { res.status(404); throw new Error('Job not found'); }
  res.status(200).json(job);
});

// @desc    Update a job posting
const updateJob = asyncHandler(async (req, res) => {
  const { title, description, job_type, city, pay_rate_min, pay_rate_max, pay_type, application_deadline, required_skills, image_url, status } = req.body;
  const job = await Job.findById(req.params.id);
  if (!job) { res.status(404); throw new Error('Job not found'); }
  if (req.user.user_type !== 'admin' && job.employer_id.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Not authorized to update this job');
  }

  let updatedLocation = job.location;
  if (city && city !== job.city) { // Only re-geocode if city has changed
    try {
      const geoResults = await geocoder.geocode(city);
      if (geoResults && geoResults.length > 0) {
        updatedLocation = {
          type: "Point",
          coordinates: [geoResults[0].longitude, geoResults[0].latitude]
        };
      } else {
        res.status(400); throw new Error(`Could not find coordinates for the new city: "${city}". Please enter a valid city.`);
      }
    } catch (geoError) {
      console.error('Geocoding service error:', geoError);
      res.status(500); throw new Error('Error updating job location. Please try again later or verify the city.');
    }
  }

  job.title = title || job.title;
  job.description = description || job.description;
  job.job_type = job_type || job.job_type;
  job.city = city || job.city;
  job.location = updatedLocation;
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
const deleteJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) { res.status(404); throw new Error('Job not found'); }
  if (req.user.user_type !== 'admin' && job.employer_id.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error('Not authorized to delete this job');
  }
  await job.deleteOne();
  res.status(200).json({ message: 'Job removed successfully' });
});

// @desc    Get jobs posted by the authenticated employer
const getEmployerJobs = asyncHandler(async (req, res) => {
  const employerId = req.user._id;
  const jobs = await Job.find({ employer_id: employerId })
                        .sort({ createdAt: -1 });
  if (jobs) { res.status(200).json(jobs); } else { res.status(404).json({ message: 'No jobs found for this employer.' }); }
});

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getEmployerJobs,
};