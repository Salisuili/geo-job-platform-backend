const express = require('express');
const router = express.Router();
const {
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
    uploadJobImage, // MODIFIED: Use specific job image upload middleware
    uploadApplicationDocs // NEW: Import application documents upload middleware
} = require('../controllers/jobController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// --- IMPORTANT: ORDER MATTERS! Place more specific routes before generic ones. ---

// 1. Get applications for the logged-in laborer
// This MUST come before router.route('/:id') to avoid 'my-applications' being treated as an ID
router.get('/my-applications', protect, authorizeRoles('laborer'), getMyApplications);

// 2. Get jobs posted by the current employer/admin
router.get('/my-jobs', protect, authorizeRoles('employer', 'admin'), getEmployerJobs);

// 3. Route for fetching applicants for a specific job (employer/admin)
router.get('/:jobId/applicants', protect, authorizeRoles('employer'), getApplicantsForSpecificJob);

// 4. Route for a laborer to apply for a job with file uploads
router.post('/:id/apply', protect, authorizeRoles('laborer'), uploadApplicationDocs, applyForJob);

// 5. Main job routes for creation and getting all jobs (general public or logged-in)
router.route('/')
    .post(protect, authorizeRoles('employer', 'admin'), uploadJobImage.single('jobImage'), createJob)
    .get(getAllJobs);

// 6. Generic route for single job operations (MUST come after all more specific routes)
router.route('/:id')
    .get(getJobById)
    .put(protect, authorizeRoles('employer', 'admin'), uploadJobImage.single('jobImage'), updateJob)
    .delete(protect, authorizeRoles('employer', 'admin'), deleteJob);

// 7. Update application status
router.put('/applications/:id/status', protect, authorizeRoles('employer'), updateApplicationStatus);

module.exports = router;