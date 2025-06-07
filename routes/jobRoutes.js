const express = require('express');
const router = express.Router();
const {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getEmployerJobs, 
} = require('../controllers/jobController'); 
const { protect, authorizeRoles } = require('../middleware/authMiddleware'); 

router.get('/my-jobs', protect, authorizeRoles('employer', 'admin'), getEmployerJobs);

router.route('/')
  .post(protect, authorizeRoles('employer', 'admin'), createJob) 
  .get(getAllJobs); 

router.route('/:id')
  .get(getJobById) 
  .put(protect, authorizeRoles('employer', 'admin'), updateJob) 
  .delete(protect, authorizeRoles('employer', 'admin'), deleteJob); 


module.exports = router;