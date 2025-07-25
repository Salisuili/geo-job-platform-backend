const Job = require('../models/Job');
const Application = require('../models/Application'); // Ensure Application model is imported
const asyncHandler = require('../middleware/asyncHandler');
const NodeGeocoder = require('node-geocoder');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Node Geocoder (unchanged)
const options = {
    provider: 'openstreetmap',
    formatter: null
};
const geocoder = NodeGeocoder(options);

// --- Multer Configuration for Job Image Uploads (Existing) ---
const jobImageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/job_images/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    }
});

const jobImageFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed for job images!'), false);
    }
};

const uploadJobImage = multer({
    storage: jobImageStorage,
    fileFilter: jobImageFileFilter,
    limits: { fileSize: 1024 * 1024 * 5 } // 5MB limit
});

// Corrected: Default image path for consistency across frontend and backend
const DEFAULT_JOB_IMAGE_PATH = '/uploads/geo_job_default.jpg';

// --- Multer Configuration for Application Documents (Resume, Cover Letter) ---
const applicationDocStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/applications_docs/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const originalname = file.originalname;
        const ext = path.extname(originalname);
        const name = path.basename(originalname, ext);
        cb(null, `${name}-${Date.now()}-${req.user._id}${ext}`);
    }
});

const applicationDocFileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed for resumes/cover letters!'), false);
    }
};

const uploadApplicationDocs = multer({
    storage: applicationDocStorage,
    fileFilter: applicationDocFileFilter,
    limits: { fileSize: 1024 * 1024 * 10 } // 10MB limit for documents
}).fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 }
]);


// @desc    Create a new job posting
// @route   POST /api/jobs
// @access  Private (Employer/Admin only)
const createJob = asyncHandler(async (req, res) => {
    const { title, description, job_type, city, pay_rate_min, pay_rate_max, pay_type, application_deadline, required_skills } = req.body;

    const image_url = req.file ? `/uploads/job_images/${req.file.filename}` : DEFAULT_JOB_IMAGE_PATH;

    if (!title || !description || !job_type || !city || !pay_rate_min || !pay_rate_max || !pay_type) {
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting partially uploaded job image:", err);
            });
        }
        res.status(400);
        throw new Error('Please fill in all required job fields (title, description, job type, city, pay rates, pay type).');
    }

    let geoCoordinates = [0, 0]; // Default coordinates if geocoding fails
    let formattedAddress = city; // Default to the input city

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
            // Geocoding found no results, proceed with default coordinates
        }
    } catch (geoError) {
        // Geocoding service error, proceed with default coordinates
        console.error('Geocoding service error during job creation:', geoError);
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
        pay_rate_min: parseFloat(pay_rate_min),
        pay_rate_max: parseFloat(pay_rate_max),
        pay_type,
        application_deadline: application_deadline ? new Date(application_deadline).toISOString() : undefined,
        required_skills: required_skills ? required_skills.split(',').map(s => s.trim()) : [],
        image_url,
        status: 'Active',
    });

    res.status(201).json(job);
});

// @desc    Get all job postings with filters and pagination
// @route   GET /api/jobs
// @access  Public
const getAllJobs = asyncHandler(async (req, res) => {
    let query = {};
    let isGeospatialQuery = false;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10; // Default limit to 10 if not provided
    const skip = (page - 1) * limit;

    // Build the base query/match conditions
    if (req.query.employerId) {
        query.employer_id = req.query.employerId;
    }
    if (req.query.status) {
        query.status = req.query.status;
    }
    if (req.query.skills) {
        const skillsArray = req.query.skills.split(',').map(s => new RegExp(s.trim(), 'i'));
        query.required_skills = { $in: skillsArray };
    }

    if (req.query.jobType) {
        const jobTypesArray = req.query.jobType.split(',').map(type => type.trim());
        query.job_type = { $in: jobTypesArray.map(type => new RegExp(type, 'i')) };
    }

    if (req.query.city) {
        query.city = new RegExp(req.query.city, 'i');
    }

    if (req.query.datePosted) {
        const now = new Date();
        let cutOffDate;

        switch (req.query.datePosted) {
            case '24h':
                cutOffDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                break;
            case '3d':
                cutOffDate = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
                break;
            case '7d':
                cutOffDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                break;
            case '30d':
                cutOffDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                break;
        }

        if (cutOffDate) {
            query.posted_at = { $gte: cutOffDate };
        }
    }

    let payRateConditions = [];

    if (req.query.minPay) {
        const minPay = parseFloat(req.query.minPay);
        if (!isNaN(minPay)) {
            payRateConditions.push({ pay_rate_max: { $gte: minPay } });
        }
    }

    if (req.query.maxPay) {
        const maxPay = parseFloat(req.query.maxPay);
        if (!isNaN(maxPay)) {
            payRateConditions.push({ pay_rate_min: { $lte: maxPay } });
        }
    }

    if (payRateConditions.length > 0) {
        if (query.$and) {
            query.$and = query.$and.concat(payRateConditions);
        } else if (Object.keys(query).length > 0) {
            query = { $and: [query].concat(payRateConditions) };
        } else {
            query = { $and: payRateConditions };
        }
    }

    try {
        let jobs = [];
        let total = 0;

        // Check if it's a geospatial query
        if (req.query.long && req.query.lat && req.query.maxDistance) {
            isGeospatialQuery = true;
            const longitude = parseFloat(req.query.long);
            const latitude = parseFloat(req.query.lat);
            const maxDistance = parseInt(req.query.maxDistance);

            // Aggregation pipeline for geospatial query
            const pipeline = [
                {
                    $geoNear: {
                        near: {
                            type: "Point",
                            coordinates: [longitude, latitude]
                        },
                        distanceField: "distance", // Output distance in meters
                        maxDistance: maxDistance,
                        spherical: true,
                        // Apply other query filters here before $geoNear
                        query: query // This applies all other filters to the documents before geoNear
                    }
                },
                // Sort by distance (default for $geoNear), then by posted_at if needed
                { $sort: { distance: 1, posted_at: -1 } },
                {
                    $lookup: {
                        from: 'users', // The collection name for the User model
                        localField: 'employer_id',
                        foreignField: '_id',
                        as: 'employer_id'
                    }
                },
                { $unwind: '$employer_id' }, // Deconstructs the array field from the input documents to output a document for each element.
                {
                    $project: { // Project only necessary fields for employer_id
                        'employer_id.full_name': 1,
                        'employer_id.company_name': 1,
                        'employer_id.email': 1,
                        'employer_id.profile_picture_url': 1,
                        title: 1,
                        description: 1,
                        job_type: 1,
                        city: 1,
                        location: 1,
                        pay_rate_min: 1,
                        pay_rate_max: 1,
                        pay_type: 1,
                        application_deadline: 1,
                        required_skills: 1,
                        image_url: 1,
                        status: 1,
                        posted_at: 1,
                        distance: 1 // Include distance in the output
                    }
                },
                {
                    $facet: {
                        metadata: [{ $count: "total" }],
                        data: [{ $skip: skip }, { $limit: limit }]
                    }
                }
            ];

            const result = await Job.aggregate(pipeline);

            // Extract jobs and total from the faceted result
            jobs = result[0].data || [];
            total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

        } else {
            // Standard Mongoose find for non-geospatial queries
            total = await Job.countDocuments(query);
            jobs = await Job.find(query)
                .populate('employer_id', 'full_name company_name email profile_picture_url')
                .sort({ posted_at: -1 }) // Sort by posted_at for non-geo queries
                .skip(skip)
                .limit(limit);
        }

        res.status(200).json({ jobs, total }); // Return both jobs and total count
    } catch (dbError) {
        console.error("MongoDB Query Error in getAllJobs:", dbError);
        // Provide more specific error messages for the frontend
        if (dbError.message.includes('geo near') || dbError.message.includes('2dsphere')) {
            res.status(500).json({
                message: 'Geospatial search error. Please ensure a 2dsphere index exists on the location.coordinates field in your MongoDB "jobs" collection and that your query is correctly structured.',
                error: dbError.message
            });
        } else {
            res.status(500).json({ message: 'Failed to fetch jobs due to a database error.', error: dbError.message });
        }
    }
});

// @desc    Get a single job by ID
// @route   GET /api/jobs/:id
// @access  Public
const getJobById = asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('employer_id', 'full_name company_name email profile_picture_url');

    if (!job) {
        res.status(404);
        throw new Error('Job not found');
    }

    let hasApplied = false;
    if (req.user && req.user.user_type === 'laborer') {
        const existingApplication = await Application.findOne({
            job_id: job._id,
            applicant_id: req.user._id,
        });
        if (existingApplication) {
            hasApplied = true;
        }
    }

    res.status(200).json({ job, hasApplied });
});


// @desc    Update a job posting
// @route   PUT /api/jobs/:id
// @access  Private (Employer/Admin only)
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
                // If geocoding fails on update, just keep the old coordinates/address or set to default
            }
        } catch (geoError) {
            console.error('Geocoding service error during update:', geoError);
            // No need to throw an error here, just use defaults
        }
    }

    let new_image_url = job.image_url;
    if (req.file) {
        new_image_url = `/uploads/job_images/${req.file.filename}`;
        if (job.image_url && job.image_url.startsWith('/uploads/job_images/') && job.image_url !== DEFAULT_JOB_IMAGE_PATH) {
            const oldImagePath = path.join(__dirname, '..', job.image_url);
            fs.unlink(oldImagePath, (err) => {
                if (err) console.error("Error deleting old job image:", err);
            });
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
    job.required_skills = required_skills ? required_skills.split(',').map(s => s.trim()) : job.required_skills;
    job.image_url = new_image_url;
    job.status = status || job.status;

    const updatedJob = await job.save();
    res.status(200).json(updatedJob);
});

// @desc    Delete a job posting
// @route   DELETE /api/jobs/:id
// @access  Private (Employer/Admin only)
const deleteJob = asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id);
    if (!job) { res.status(404); throw new Error('Job not found'); }
    if (req.user.user_type !== 'admin' && job.employer_id.toString() !== req.user._id.toString()) {
        res.status(403); throw new Error('Not authorized to delete this job');
    }
    if (job.image_url && job.image_url.startsWith('/uploads/job_images/') && job.image_url !== DEFAULT_JOB_IMAGE_PATH) {
        const imagePathToDelete = path.join(__dirname, '..', job.image_url);
        fs.unlink(imagePathToDelete, (err) => {
            if (err) console.error("Error deleting job image on delete:", err);
        });
    }
    await job.deleteOne();
    res.status(200).json({ message: 'Job removed successfully' });
});

// @desc    Get jobs posted by the authenticated employer
// @route   GET /api/jobs/my-jobs
// @access  Private (Employer/Admin only)
const getEmployerJobs = asyncHandler(async (req, res) => {
    const employerId = req.user._id;

    // Fetch jobs and then count applications for each
    const jobs = await Job.find({ employer_id: employerId })
        .sort({ posted_at: -1 })
        .lean(); // Use .lean() to get plain JavaScript objects for easier modification


    if (!jobs || jobs.length === 0) {
        return res.status(200).json([]); // Return empty array if no jobs found
    }

    // Get all job IDs for the current employer
    const jobIds = jobs.map(job => job._id);

    // Aggregate application counts for all jobs in one go
    const applicationCounts = await Application.aggregate([
        { $match: { job_id: { $in: jobIds } } }, // Match applications for these job IDs
        { $group: { _id: '$job_id', count: { $sum: 1 } } } // Group by job_id and count
    ]);

    // Create a map for quick lookup of counts
    const countsMap = new Map();
    applicationCounts.forEach(item => {
        countsMap.set(item._id.toString(), item.count);
    });

    // Add applicants_count to each job object
    const jobsWithApplicantsCount = jobs.map(job => {
        const applicants_count = countsMap.get(job._id.toString()) || 0;
        return { ...job, applicants_count };
    });

    res.status(200).json(jobsWithApplicantsCount);
});


// @desc    Allow a laborer to apply for a job
// @route   POST /api/jobs/:id/apply
// @access  Private (Laborer)
const applyForJob = asyncHandler(async (req, res) => {
    const jobId = req.params.id;
    const applicantId = req.user._id;

    if (req.user.user_type !== 'laborer') {
        if (req.files) {
            if (req.files.resume && req.files.resume[0]) fs.unlink(req.files.resume[0].path, (err) => console.error("Error deleting uploaded resume:", err));
            if (req.files.coverLetter && req.files.coverLetter[0]) fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting uploaded cover letter:", err));
        }
        res.status(403);
        throw new Error('Only laborers can apply for jobs.');
    }

    if (!req.files || !req.files.resume || req.files.resume.length === 0) {
        if (req.files && req.files.coverLetter && req.files.coverLetter[0]) {
            fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting orphaned cover letter:", err));
        }
        res.status(400);
        throw new Error('Resume file is required.');
    }

    const resumePath = `/uploads/applications_docs/${req.files.resume[0].filename}`;
    const coverLetterPath = req.files.coverLetter && req.files.coverLetter[0] ?
        `/uploads/applications_docs/${req.files.coverLetter[0].filename}` : null;

    const job = await Job.findById(jobId);
    if (!job) {
        fs.unlink(req.files.resume[0].path, (err) => console.error("Error deleting resume for non-existent job:", err));
        if (coverLetterPath) fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting cover letter for non-existent job:", err));
        res.status(404);
        throw new Error('Job not found.');
    }

    if (job.status !== 'Active') {
        fs.unlink(req.files.resume[0].path, (err) => console.error("Error deleting resume for inactive job:", err));
        if (coverLetterPath) fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting cover letter for inactive job:", err));
        res.status(400);
        throw new Error('This job is not currently active for applications.');
    }

    const existingApplication = await Application.findOne({
        job_id: jobId,
        applicant_id: applicantId,
    });
    if (existingApplication) {
        fs.unlink(req.files.resume[0].path, (err) => console.error("Error deleting resume for duplicate application:", err));
        if (coverLetterPath) fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting cover letter for duplicate application:", err));
        res.status(400);
        throw new Error('You have already applied for this job.');
    }

    const newApplication = new Application({
        job_id: jobId,
        applicant_id: applicantId,
        status: 'Pending',
        resume_url: resumePath,
        cover_letter_url: coverLetterPath,
    });

    await newApplication.save();

    res.status(201).json({ message: 'Application submitted successfully!', application: newApplication });
});

// @desc    Get all applications for a specific job posted by the authenticated employer
// @route   GET /api/jobs/:jobId/applicants
// @access  Private (Employer)
const getApplicantsForSpecificJob = asyncHandler(async (req, res) => {
    const jobId = req.params.jobId;
    const employerId = req.user._id;

    if (req.user.user_type !== 'employer' && req.user.user_type !== 'admin') {
        res.status(403);
        throw new Error('Only employers and admins can view job applicants.');
    }

    const job = await Job.findOne({ _id: jobId, employer_id: employerId });
    if (!job) {
        res.status(404);
        throw new Error('Job not found or you are not authorized to view applicants for this job.');
    }

    const applications = await Application.find({ job_id: jobId })
        .populate('applicant_id', 'username full_name email phone_number profile_picture_url bio skills hourly_rate is_available')
        .sort({ createdAt: -1 });

    res.status(200).json({ jobTitle: job.title, applications });
});

// @desc    Get all applications submitted by the authenticated laborer
// @route   GET /api/applications/my-applications
// @access  Private (Laborer)
const getMyApplications = asyncHandler(async (req, res) => {
    const laborerId = req.user._id;

    if (req.user.user_type !== 'laborer') {
        res.status(403);
        throw new Error('Only laborers can view their applications.');
    }

    const applications = await Application.find({ applicant_id: laborerId })
        .populate('job_id', 'title description job_type city status image_url pay_rate_min pay_rate_max pay_type company_name')
        .sort({ createdAt: -1 });

    res.status(200).json({ applications });
});

// @desc    Update the status of a specific job application (by employer)
// @route   PUT /api/applications/:id/status
// @access  Private (Employer)
const updateApplicationStatus = asyncHandler(async (req, res) => {
    const applicationId = req.params.id;
    const employerId = req.user._id;
    const { status } = req.body;

    if (req.user.user_type !== 'employer') {
        res.status(403);
        throw new Error('Only employers can update application status.');
    }

    const validStatuses = ['Pending', 'Reviewed', 'Interview Scheduled', 'Accepted', 'Rejected'];
    if (!validStatuses.includes(status)) {
        res.status(400);
        throw new Error('Invalid application status provided.');
    }

    const application = await Application.findById(applicationId).populate({
        path: 'job_id',
        select: 'employer_id'
    });

    if (!application) {
        res.status(404);
        throw new Error('Application not found.');
    }

    if (!application.job_id || application.job_id.employer_id.toString() !== employerId.toString()) {
        res.status(403);
        throw new Error('Not authorized to update this application status.');
    }

    application.status = status;
    await application.save();

    res.status(200).json({ message: 'Application status updated successfully', application });
});


module.exports = {
    createJob,
    getAllJobs,
    getJobById,
    updateJob,
    deleteJob,
    getEmployerJobs,
    applyForJob,
    getApplicantsForSpecificJob,
    getMyApplications,
    updateApplicationStatus,
    uploadJobImage,
    uploadApplicationDocs
};
