const Job = require('../models/Job');
const asyncHandler = require('../middleware/asyncHandler');
const NodeGeocoder = require('node-geocoder');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Make sure fs is imported for file operations

// Configure Node Geocoder for OpenStreetMap Nominatim
const options = {
    provider: 'openstreetmap',
    formatter: null
};
const geocoder = NodeGeocoder(options);

// Multer Configuration for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        // Create the uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 1024 * 1024 * 5 } // 5MB file size limit
});

// ADDED: Define a default image path for jobs
const DEFAULT_JOB_IMAGE_PATH = '/uploads/geo_job_default.jpg'; // Make sure this file exists in your backend's 'uploads' directory

// @desc    Create a new job posting
// @route   POST /api/jobs
// @access  Private (Employer/Admin only)
const createJob = asyncHandler(async (req, res) => {
    const { title, description, job_type, city, pay_rate_min, pay_rate_max, pay_type, application_deadline, required_skills } = req.body;

    // MODIFIED: If req.file exists, use uploaded image path; otherwise, use the default path.
    const image_url = req.file ? `/uploads/${req.file.filename}` : DEFAULT_JOB_IMAGE_PATH;

    if (!title || !description || !job_type || !city || !pay_rate_min || !pay_rate_max || !pay_type) {
        // If validation fails and a file was uploaded, consider deleting it to prevent orphaned files.
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting partially uploaded file:", err);
            });
        }
        res.status(400);
        throw new Error('Please fill in all required job fields (title, description, job type, city, pay rates, pay type).');
    }

    let geoCoordinates;
    let formattedAddress = city; // Fallback to original city input

    try {
        const geoResults = await geocoder.geocode(city);

        if (geoResults && geoResults.length > 0) {
            geoCoordinates = [geoResults[0].longitude, geoResults[0].latitude];
            if (geoResults[0].formattedAddress) {
                formattedAddress = geoResults[0].formattedAddress;
            } else if (geoResults[0].city && geoResults[0].country) {
                formattedAddress = `${geoResults[0].city}, ${geoResults[0].country}`;
            }
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
        coordinates: geoCoordinates,
        address_text: formattedAddress
    };

    const job = await Job.create({
        employer_id: req.user._id,
        title,
        description,
        job_type,
        city,
        location,
        pay_rate_min: parseFloat(pay_rate_min), // Corrected variable name here
        pay_rate_max: parseFloat(pay_rate_max), // Corrected variable name here
        pay_type,
        application_deadline: application_deadline ? new Date(application_deadline).toISOString() : undefined,
        required_skills: required_skills ? required_skills.split(',').map(s => s.trim()) : [],
        image_url, // This will now always have a value (uploaded path or default path)
        status: 'Active',
    });

    res.status(201).json(job);
});

// @desc    Get all job postings with filters
// @route   GET /api/jobs
// @access  Public
const getAllJobs = asyncHandler(async (req, res) => {
    let query = {};

    // Existing filters from your base code
    if (req.query.employerId) {
        query.employer_id = req.query.employerId;
    }
    if (req.query.status) {
        query.status = req.query.status;
    }
    // Note: The `skills` filter needs to be carefully considered if `required_skills` is an array.
    // If you want to match jobs that have *any* of the specified skills, the current approach is fine.
    // If you want to match jobs that have *all* of the specified skills, the query would be different.
    if (req.query.skills) {
        const skillsArray = req.query.skills.split(',').map(s => new RegExp(s.trim(), 'i'));
        query.required_skills = { $in: skillsArray };
    }

    // --- NEW FILTER LOGIC (as discussed, integrated into your current structure) ---

    // 1. Job Type Filter: Handles multiple job types (e.g., "Full-time,Part-time")
    if (req.query.jobType) {
        // Split the comma-separated string of job types into an array
        const jobTypesArray = req.query.jobType.split(',').map(type => type.trim());
        // Use $in to match any job where job_type is one of the provided types (case-insensitive)
        query.job_type = { $in: jobTypesArray.map(type => new RegExp(type, 'i')) };
    }

    // 2. Location (City) Filter
    // This uses your existing city filter, just ensuring it's applied correctly.
    if (req.query.city) {
        query.city = new RegExp(req.query.city, 'i'); // Case-insensitive search for city
    }

    // 3. Date Posted Filter (e.g., '24h', '3d', '7d', '30d')
    if (req.query.datePosted) {
        const now = new Date();
        let cutOffDate;

        switch (req.query.datePosted) {
            case '24h':
                cutOffDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Last 24 hours
                break;
            case '3d':
                cutOffDate = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000)); // Last 3 days
                break;
            case '7d':
                cutOffDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Last 7 days
                break;
            case '30d':
                cutOffDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // Last 30 days
                break;
            // No default case needed if we only want these specific values
        }

        if (cutOffDate) {
            query.posted_at = { $gte: cutOffDate }; // Find jobs posted on or after this date
        }
    }

    // 4. Pay Rate Filters (Min and Max Pay)
    // This logic finds jobs whose pay range [job.pay_rate_min, job.pay_rate_max]
    // overlaps with the user's requested filter range [filterMinPay, filterMaxPay].
    let payRateConditions = [];

    if (req.query.minPay) {
        const minPay = parseFloat(req.query.minPay);
        if (!isNaN(minPay)) {
            // Job's maximum pay must be greater than or equal to the filter's minimum pay
            payRateConditions.push({ pay_rate_max: { $gte: minPay } });
        }
    }

    if (req.query.maxPay) {
        const maxPay = parseFloat(req.query.maxPay);
        if (!isNaN(maxPay)) {
            // Job's minimum pay must be less than or equal to the filter's maximum pay
            payRateConditions.push({ pay_rate_min: { $lte: maxPay } });
        }
    }

    if (payRateConditions.length > 0) {
        // If there are existing conditions in 'query', combine them with $and
        // This ensures all conditions (existing and new pay rate conditions) are met.
        if (query.$and) {
            query.$and = query.$and.concat(payRateConditions);
        } else if (Object.keys(query).length > 0) {
            // If query has other properties but no $and yet
            query = { $and: [query].concat(payRateConditions) };
        } else {
            // If query is empty, just use the payRateConditions
            query = { $and: payRateConditions };
        }
    }

    // --- Geospatial Filter (keep as is) ---
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

    // Sort by newest first
    const jobs = await Job.find(query)
        .populate('employer_id', 'full_name company_name email profile_picture_url')
        .sort({ posted_at: -1 });

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
    const { title, description, job_type, city, pay_rate_min, pay_rate_max, pay_type, application_deadline, required_skills, status } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) { res.status(404); throw new Error('Job not found'); }
    if (req.user.user_type !== 'admin' && job.employer_id.toString() !== req.user._id.toString()) {
        res.status(403); throw new Error('Not authorized to update this job');
    }

    let updatedLocation = job.location;
    let newFormattedAddress = job.location.address_text || job.city;

    if (city && city !== job.city) {
        try {
            const geoResults = await geocoder.geocode(city);
            if (geoResults && geoResults.length > 0) {
                updatedLocation = {
                    type: "Point",
                    coordinates: [geoResults[0].longitude, geoResults[0].latitude]
                };
                if (geoResults[0].formattedAddress) {
                    newFormattedAddress = geoResults[0].formattedAddress;
                } else if (geoResults[0].city && geoResults[0].country) {
                    newFormattedAddress = `${geoResults[0].city}, ${geoResults[0].country}`;
                }
                updatedLocation.address_text = newFormattedAddress;
            } else {
                res.status(400); throw new Error(`Could not find coordinates for the new city: "${city}". Please enter a valid city.`);
            }
        } catch (geoError) {
            console.error('Geocoding service error:', geoError);
            res.status(500); throw new Error('Error updating job location. Please try again later or verify the city.');
        }
    }

    // Handle image update:
    let new_image_url = job.image_url; // Default to existing image from DB
    if (req.file) { // If a new file was uploaded, use its path
        new_image_url = `/uploads/${req.file.filename}`;
        // OPTIONAL: Delete the old image file if it exists and is not the default image path
        if (job.image_url && job.image_url.startsWith('/uploads/') && job.image_url !== DEFAULT_JOB_IMAGE_PATH) {
            const oldImagePath = path.join(__dirname, '..', job.image_url);
            fs.unlink(oldImagePath, (err) => {
                if (err) console.error("Error deleting old image:", err);
            });
        }
    }
    // IMPORTANT: If you want to explicitly allow clearing an image to revert to default
    // without uploading a new one, you'd need a separate flag from the frontend.
    // For now, if no new file is uploaded, the existing image (be it custom or default) remains.


    job.title = title || job.title;
    job.description = description || job.description;
    job.job_type = job_type || job.job_type;
    job.city = city || job.city;
    job.location = updatedLocation;
    job.pay_rate_min = pay_rate_min !== undefined ? pay_rate_min : job.pay_rate_min;
    job.pay_rate_max = pay_rate_max !== undefined ? pay_rate_max : job.pay_rate_max;
    job.pay_type = pay_type || job.pay_type;
    job.application_deadline = application_deadline || job.application_deadline;
    job.required_skills = required_skills ? required_skills.split(',').map(s => s.trim()) : job.required_skills;
    job.image_url = new_image_url;
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
    // OPTIONAL: Delete associated image file when job is deleted, if it's not the default image
    if (job.image_url && job.image_url.startsWith('/uploads/') && job.image_url !== DEFAULT_JOB_IMAGE_PATH) {
        const imagePathToDelete = path.join(__dirname, '..', job.image_url);
        fs.unlink(imagePathToDelete, (err) => {
            if (err) console.error("Error deleting job image on delete:", err);
        });
    }
    await job.deleteOne();
    res.status(200).json({ message: 'Job removed successfully' });
});

// @desc    Get jobs posted by the authenticated employer
const getEmployerJobs = asyncHandler(async (req, res) => {
    const employerId = req.user._id;
    const jobs = await Job.find({ employer_id: employerId })
        .sort({ posted_at: -1 });
    if (jobs) { res.status(200).json(jobs); } else { res.status(404).json({ message: 'No jobs found for this employer.' }); }
});

module.exports = {
    createJob,
    getAllJobs,
    getJobById,
    updateJob,
    deleteJob,
    getEmployerJobs,
    upload
};