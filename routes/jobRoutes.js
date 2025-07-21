const express = require('express');
const router = express.Router();
const {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getEmployerJobs,
  upload // IMPORTED: Multer upload middleware
} = require('../controllers/jobController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/my-jobs', protect, authorizeRoles('employer', 'admin'), getEmployerJobs);

router.route('/')
  // ADDED: `upload.single('jobImage')` middleware for file upload
  .post(protect, authorizeRoles('employer', 'admin'), upload.single('jobImage'), createJob)
  .get(getAllJobs);

router.route('/:id')
  .get(getJobById)
  // ADDED: `upload.single('jobImage')` middleware for file upload on update
  .put(protect, authorizeRoles('employer', 'admin'), upload.single('jobImage'), updateJob)
  .delete(protect, authorizeRoles('employer', 'admin'), deleteJob);


module.exports = router;