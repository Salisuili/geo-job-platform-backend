// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    getEmployers,
    getEmployerById,
    updateEmployer,
    deleteEmployer,
    getLaborers,
    getLaborerById,
    updateLaborer,
    deleteLaborer,
    // Import new job functions
    getJobs,
    getJobById,
    updateJob,
    deleteJob
} = require('../controllers/adminController');

// Protect all admin routes and ensure user is an 'admin'
router.use(protect);
router.use(authorizeRoles('admin')); // Only 'admin' users can access these routes

// --- Employer Routes ---
// @route   GET /api/admin/employers
router.get('/employers', getEmployers);
// @route   GET /api/admin/employers/:id
router.get('/employers/:id', getEmployerById);
// @route   PUT /api/admin/employers/:id
router.put('/employers/:id', updateEmployer);
// @route   DELETE /api/admin/employers/:id
router.delete('/employers/:id', deleteEmployer);

// --- Laborer Routes ---
// @route   GET /api/admin/laborers
router.get('/laborers', getLaborers);
// @route   GET /api/admin/laborers/:id
router.get('/laborers/:id', getLaborerById);
// @route   PUT /api/admin/laborers/:id
router.put('/laborers/:id', updateLaborer);
// @route   DELETE /api/admin/laborers/:id
router.delete('/laborers/:id', deleteLaborer);

// --- NEW: Job Routes ---
// @route   GET /api/admin/jobs
router.get('/jobs', getJobs);
// @route   GET /api/admin/jobs/:id
router.get('/jobs/:id', getJobById);
// @route   PUT /api/admin/jobs/:id
router.put('/jobs/:id', updateJob);
// @route   DELETE /api/admin/jobs/:id
router.delete('/jobs/:id', deleteJob);

module.exports = router;
