// local-labor-backend/routes/laborerRoutes.js
const express = require('express');
const router = express.Router();
// Import getLaborerProfileAndRatings from userController
// as you placed it there.
const { getLaborerProfileAndRatings } = require('../controllers/userController'); 

// @route GET /api/laborers/:id
// @desc Get a single laborer profile with ratings and reviews
// @access Public (you can add protect middleware later if needed)
router.get('/:id', getLaborerProfileAndRatings);

module.exports = router;