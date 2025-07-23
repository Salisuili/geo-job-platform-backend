const Job = require('../models/Job');
const Application = require('../models/Application');
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
        const uploadDir = 'uploads/job_images/'; // Changed directory for job images
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
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

// ADDED: Define a default image path for jobs
const DEFAULT_JOB_IMAGE_PATH = '/uploads/job_images/geo_job_default.jpg'; // Updated path

// --- Multer Configuration for Application Documents (Resume, Cover Letter) ---
const applicationDocStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/applications_docs/'; // New directory for application documents
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Unique filename for resume/cover letter
        const originalname = file.originalname;
        const ext = path.extname(originalname);
        const name = path.basename(originalname, ext);
        cb(null, `${name}-${Date.now()}-${req.user._id}${ext}`); // Add user ID for more uniqueness
    }
});

const applicationDocFileFilter = (req, file, cb) => {
    // Allow PDF, DOC, DOCX for resumes/cover letters
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

    // MODIFIED: Use the correct uploadJobImage middleware and directory
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

    let geoCoordinates;
    let formattedAddress = city;

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

// @desc    Get all job postings with filters (UNCHANGED)
const getAllJobs = asyncHandler(async (req, res) => {
    let query = {};

    // Existing filters from your base code
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

    // --- NEW FILTER LOGIC (as discussed, integrated into your current structure) ---

    // 1. Job Type Filter: Handles multiple job types (e.g., "Full-time,Part-time")
    if (req.query.jobType) {
        const jobTypesArray = req.query.jobType.split(',').map(type => type.trim());
        query.job_type = { $in: jobTypesArray.map(type => new RegExp(type, 'i')) };
    }

    // 2. Location (City) Filter
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
        }

        if (cutOffDate) {
            query.posted_at = { $gte: cutOffDate }; // Find jobs posted on or after this date
        }
    }

    // 4. Pay Rate Filters (Min and Max Pay)
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

// @desc    Get a single job by ID (UNCHANGED logic, but new response structure)
const getJobById = asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id)
        .populate('employer_id', 'full_name company_name email profile_picture_url');

    if (!job) {
        res.status(404);
        throw new Error('Job not found');
    }

    let hasApplied = false;
    // If a user is logged in AND is a laborer, check if they have applied to this job
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

    // Handle image update: (MODIFIED PATHS)
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
const deleteJob = asyncHandler(async (req, res) => {
    const job = await Job.findById(req.params.id);
    if (!job) { res.status(404); throw new Error('Job not found'); }
    if (req.user.user_type !== 'admin' && job.employer_id.toString() !== req.user._id.toString()) {
        res.status(403); throw new Error('Not authorized to delete this job');
    }
    // OPTIONAL: Delete associated image file when job is deleted, if it's not the default image
    if (job.image_url && job.image_url.startsWith('/uploads/job_images/') && job.image_url !== DEFAULT_JOB_IMAGE_PATH) {
        const imagePathToDelete = path.join(__dirname, '..', job.image_url);
        fs.unlink(imagePathToDelete, (err) => {
            if (err) console.error("Error deleting job image on delete:", err);
        });
    }
    await job.deleteOne();
    res.status(200).json({ message: 'Job removed successfully' });
});

// @desc    Get jobs posted by the authenticated employer (UNCHANGED)
const getEmployerJobs = asyncHandler(async (req, res) => {
    const employerId = req.user._id;
    const jobs = await Job.find({ employer_id: employerId })
        .sort({ posted_at: -1 });
    if (jobs) { res.status(200).json(jobs); } else { res.status(404).json({ message: 'No jobs found for this employer.' }); }
});

// @desc    Allow a laborer to apply for a job
// @route   POST /api/jobs/:id/apply
// @access  Private (Laborer)
const applyForJob = asyncHandler(async (req, res) => {
    const jobId = req.params.id;
    const applicantId = req.user._id;

    // 1. Ensure the logged-in user is a 'laborer'
    if (req.user.user_type !== 'laborer') {
        // If files were uploaded before this check, delete them
        if (req.files) {
            if (req.files.resume && req.files.resume[0]) fs.unlink(req.files.resume[0].path, (err) => console.error("Error deleting uploaded resume:", err));
            if (req.files.coverLetter && req.files.coverLetter[0]) fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting uploaded cover letter:", err));
        }
        res.status(403);
        throw new Error('Only laborers can apply for jobs.');
    }

    // 2. Validate files
    if (!req.files || !req.files.resume || req.files.resume.length === 0) {
        // If cover letter was uploaded but resume is missing, delete cover letter
        if (req.files && req.files.coverLetter && req.files.coverLetter[0]) {
            fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting orphaned cover letter:", err));
        }
        res.status(400);
        throw new Error('Resume file is required.');
    }

    const resumePath = `/uploads/applications_docs/${req.files.resume[0].filename}`;
    const coverLetterPath = req.files.coverLetter && req.files.coverLetter[0] ?
        `/uploads/applications_docs/${req.files.coverLetter[0].filename}` : null;

    // 3. Check if the job exists
    const job = await Job.findById(jobId);
    if (!job) {
        // Delete uploaded files if job not found
        fs.unlink(req.files.resume[0].path, (err) => console.error("Error deleting resume for non-existent job:", err));
        if (coverLetterPath) fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting cover letter for non-existent job:", err));
        res.status(404);
        throw new Error('Job not found.');
    }

    // 4. Check if the job is active
    if (job.status !== 'Active') {
        // Delete uploaded files if job not active
        fs.unlink(req.files.resume[0].path, (err) => console.error("Error deleting resume for inactive job:", err));
        if (coverLetterPath) fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting cover letter for inactive job:", err));
        res.status(400);
        throw new Error('This job is not currently active for applications.');
    }

    // 5. Check if the laborer has already applied for this job
    const existingApplication = await Application.findOne({
        job_id: jobId,
        applicant_id: applicantId,
    });
    if (existingApplication) {
        // Delete uploaded files if already applied
        fs.unlink(req.files.resume[0].path, (err) => console.error("Error deleting resume for duplicate application:", err));
        if (coverLetterPath) fs.unlink(req.files.coverLetter[0].path, (err) => console.error("Error deleting cover letter for duplicate application:", err));
        res.status(400);
        throw new Error('You have already applied for this job.');
    }

    // 6. Create the new application
    const newApplication = new Application({
        job_id: jobId,
        applicant_id: applicantId,
        status: 'Pending',
        resume_url: resumePath,
        cover_letter_url: coverLetterPath, // Will be null if no cover letter uploaded
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

    // 1. Ensure the logged-in user is an 'employer'
    if (req.user.user_type !== 'employer') {
        res.status(403);
        throw new Error('Only employers can view job applicants.');
    }

    // 2. Verify that the job exists AND belongs to the authenticated employer
    const job = await Job.findOne({ _id: jobId, employer_id: employerId });
    if (!job) {
        res.status(404);
        throw new Error('Job not found or you are not authorized to view applicants for this job.');
    }

    // 3. Find all applications for this specific job
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

    // 1. Ensure the logged-in user is a 'laborer'
    if (req.user.user_type !== 'laborer') {
        res.status(403);
        throw new Error('Only laborers can view their applications.');
    }

    // 2. Find all applications for this specific laborer
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

    // 1. Ensure the logged-in user is an 'employer'
    if (req.user.user_type !== 'employer') {
        res.status(403);
        throw new Error('Only employers can update application status.');
    }

    // 2. Validate new status
    const validStatuses = ['Pending', 'Reviewed', 'Interview Scheduled', 'Accepted', 'Rejected'];
    if (!validStatuses.includes(status)) {
        res.status(400);
        throw new Error('Invalid application status provided.');
    }

    // 3. Find the application and populate job details to verify employer ownership
    const application = await Application.findById(applicationId).populate({
        path: 'job_id',
        select: 'employer_id'
    });

    if (!application) {
        res.status(404);
        throw new Error('Application not found.');
    }

    // 4. Ensure the logged-in employer owns the job associated with this application
    if (!application.job_id || application.job_id.employer_id.toString() !== employerId.toString()) {
        res.status(403);
        throw new Error('Not authorized to update this application status.');
    }

    // 5. Update the status
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
    uploadJobImage, // EXPORTED: New Multer instance for job images
    uploadApplicationDocs // EXPORTED: New Multer instance for application documents
};