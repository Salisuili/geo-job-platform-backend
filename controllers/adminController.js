// src/controllers/adminController.js
const User = require('../models/User'); // Assuming your User model is here
const Job = require('../models/Job'); // Assuming your Job model is here
const asyncHandler = require('../middleware/asyncHandler'); // Your existing asyncHandler

// @desc    Get all employers (admin only)
// @route   GET /api/admin/employers
// @access  Private/Admin
const getEmployers = asyncHandler(async (req, res) => {
    // Basic pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query for employers
    let query = { user_type: 'employer' };

    // Search functionality
    if (req.query.search) {
        const searchTerm = new RegExp(req.query.search, 'i'); // Case-insensitive search
        query.$or = [
            { company_name: searchTerm },
            { email: searchTerm },
            { full_name: searchTerm } // Assuming full_name might be searched for employers too
        ];
    }

    try {
        const totalEmployers = await User.countDocuments(query);
        const employers = await User.find(query)
            .select('-password') // Exclude password from results
            .sort({ createdAt: -1 }) // Sort by most recently created
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            employers,
            currentPage: page,
            totalPages: Math.ceil(totalEmployers / limit),
            totalEmployers
        });
    } catch (error) {
        console.error("Error fetching employers for admin:", error);
        res.status(500).json({ message: 'Failed to fetch employer data.', error: error.message });
    }
});

// @desc    Get a single employer by ID (admin only)
// @route   GET /api/admin/employers/:id
// @access  Private/Admin
const getEmployerById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Ensure only 'employer' type users are fetched by this route for consistency
    const employer = await User.findOne({ _id: id, user_type: 'employer' }).select('-password');

    if (!employer) {
        res.status(404);
        throw new Error('Employer not found');
    }

    res.status(200).json(employer);
});

// @desc    Update an employer's details (admin only)
// @route   PUT /api/admin/employers/:id
// @access  Private/Admin
const updateEmployer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { company_name, email, phone_number, address_text, user_type, company_description } = req.body;

    const updateFields = {};
    if (company_name !== undefined) updateFields.company_name = company_name;
    if (email !== undefined) updateFields.email = email;
    if (phone_number !== undefined) updateFields.phone_number = phone_number;
    if (address_text !== undefined) updateFields.address_text = address_text;
    if (company_description !== undefined) updateFields.company_description = company_description;
    if (user_type !== undefined) updateFields.user_type = user_type;

    const employer = await User.findOne({ _id: id, user_type: 'employer' });

    if (!employer) {
        res.status(404);
        throw new Error('Employer not found');
    }

    const updatedEmployer = await User.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({ message: 'Employer updated successfully', employer: updatedEmployer });
});

// @desc    Delete an employer (admin only)
// @route   DELETE /api/admin/employers/:id
// @access  Private/Admin
const deleteEmployer = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const employer = await User.findOneAndDelete({ _id: id, user_type: 'employer' });

    if (!employer) {
        res.status(404);
        throw new Error('Employer not found');
    }

    res.status(200).json({ message: 'Employer deleted successfully', id });
});

// --- Laborer Management Functions (Admin Only) ---

// @desc    Get all laborers (admin only)
// @route   GET /api/admin/laborers
// @access  Private/Admin
const getLaborers = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = { user_type: 'laborer' };

    if (req.query.search) {
        const searchTerm = new RegExp(req.query.search, 'i');
        query.$or = [
            { full_name: searchTerm },
            { email: searchTerm },
            { skills: searchTerm } // Search by skills too
        ];
    }

    try {
        const totalLaborers = await User.countDocuments(query);
        const laborers = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            laborers,
            currentPage: page,
            totalPages: Math.ceil(totalLaborers / limit),
            totalLaborers
        });
    } catch (error) {
        console.error("Error fetching laborers for admin:", error);
        res.status(500).json({ message: 'Failed to fetch laborer data.', error: error.message });
    }
});

// @desc    Get a single laborer by ID (admin only)
// @route   GET /api/admin/laborers/:id
// @access  Private/Admin
const getLaborerById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const laborer = await User.findOne({ _id: id, user_type: 'laborer' }).select('-password');

    if (!laborer) {
        res.status(404);
        throw new Error('Laborer not found');
    }

    res.status(200).json(laborer);
});

// @desc    Update a laborer's details (admin only)
// @route   PUT /api/admin/laborers/:id
// @access  Private/Admin
const updateLaborer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { full_name, email, phone_number, bio, hourly_rate, is_available, skills, user_type } = req.body;

    const updateFields = {};
    if (full_name !== undefined) updateFields.full_name = full_name;
    if (email !== undefined) updateFields.email = email;
    if (phone_number !== undefined) updateFields.phone_number = phone_number;
    if (bio !== undefined) updateFields.bio = bio;
    if (hourly_rate !== undefined) updateFields.hourly_rate = parseFloat(hourly_rate); // Ensure number
    if (is_available !== undefined) updateFields.is_available = is_available; // Boolean
    if (skills !== undefined) updateFields.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim());
    if (user_type !== undefined) updateFields.user_type = user_type;

    const laborer = await User.findOne({ _id: id, user_type: 'laborer' });

    if (!laborer) {
        res.status(404);
        throw new Error('Laborer not found');
    }

    const updatedLaborer = await User.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({ message: 'Laborer updated successfully', laborer: updatedLaborer });
});

// @desc    Delete a laborer (admin only)
// @route   DELETE /api/admin/laborers/:id
// @access  Private/Admin
const deleteLaborer = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const laborer = await User.findOneAndDelete({ _id: id, user_type: 'laborer' });

    if (!laborer) {
        res.status(404);
        throw new Error('Laborer not found');
    }

    res.status(200).json({ message: 'Laborer deleted successfully', id });
});

// --- NEW: Job Management Functions (Admin Only) ---

// @desc    Get all jobs (admin only)
// @route   GET /api/admin/jobs
// @access  Private/Admin
const getJobs = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {}; // Start with an empty query to get all jobs by default

    // Search functionality (e.g., by title, description, city)
    if (req.query.search) {
        const searchTerm = new RegExp(req.query.search, 'i');
        query.$or = [
            { title: searchTerm },
            { description: searchTerm },
            { city: searchTerm },
            { 'location.address_text': searchTerm } // Search in embedded location field
        ];
    }

    // Filter by job_type if provided
    if (req.query.jobType) {
        query.job_type = { $in: req.query.jobType.split(',').map(type => type.trim()) };
    }

    // Filter by status if provided
    if (req.query.status) {
        query.status = req.query.status;
    }

    try {
        const totalJobs = await Job.countDocuments(query);
        const jobs = await Job.find(query)
            .populate('employer_id', 'company_name email') // Populate employer details
            .sort({ createdAt: -1 }) // Sort by most recently created
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            jobs,
            currentPage: page,
            totalPages: Math.ceil(totalJobs / limit),
            totalJobs
        });
    } catch (error) {
        console.error("Error fetching jobs for admin:", error);
        res.status(500).json({ message: 'Failed to fetch job data.', error: error.message });
    }
});

// @desc    Get a single job by ID (admin only)
// @route   GET /api/admin/jobs/:id
// @access  Private/Admin
const getJobById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const job = await Job.findById(id).populate('employer_id', 'company_name email');

    if (!job) {
        res.status(404);
        throw new Error('Job not found');
    }

    res.status(200).json(job);
});

// @desc    Update a job's details (admin only)
// @route   PUT /api/admin/jobs/:id
// @access  Private/Admin
const updateJob = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        title, description, job_type, pay_rate_min, pay_rate_max, pay_type,
        city, state, country, address_text, status, image_url
    } = req.body;

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (job_type !== undefined) updateFields.job_type = job_type;
    if (pay_rate_min !== undefined) updateFields.pay_rate_min = parseFloat(pay_rate_min);
    if (pay_rate_max !== undefined) updateFields.pay_rate_max = parseFloat(pay_rate_max);
    if (pay_type !== undefined) updateFields.pay_type = pay_type;
    if (status !== undefined) updateFields.status = status;
    if (image_url !== undefined) updateFields.image_url = image_url;

    // Handle location updates
    if (city !== undefined || state !== undefined || country !== undefined || address_text !== undefined) {
        updateFields.location = {
            city: city,
            state: state,
            country: country,
            address_text: address_text,
            // Preserve existing coordinates if not provided, or set to null if needed
            coordinates: req.body.coordinates // Assuming coordinates might also be sent if updated
        };
    }

    const job = await Job.findById(id);

    if (!job) {
        res.status(404);
        throw new Error('Job not found');
    }

    const updatedJob = await Job.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
    ).populate('employer_id', 'company_name email'); // Populate employer details for response

    res.status(200).json({ message: 'Job updated successfully', job: updatedJob });
});

// @desc    Delete a job (admin only)
// @route   DELETE /api/admin/jobs/:id
// @access  Private/Admin
const deleteJob = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const job = await Job.findByIdAndDelete(id);

    if (!job) {
        res.status(404);
        throw new Error('Job not found');
    }

    // Optionally, delete associated applications for this job
    // const Application = require('../models/Application');
    // await Application.deleteMany({ job_id: id });

    res.status(200).json({ message: 'Job deleted successfully', id });
});


module.exports = {
    getEmployers,
    getEmployerById,
    updateEmployer,
    deleteEmployer,
    getLaborers,
    getLaborerById,
    updateLaborer,
    deleteLaborer,
    // Export new job functions
    getJobs,
    getJobById,
    updateJob,
    deleteJob
};
