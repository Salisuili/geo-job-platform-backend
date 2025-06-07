// local-labor-backend/models/Job.js
const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  employer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // References the User model
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  job_type: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Seasonal'],
    required: true,
  },
  // Geospatial location for the job
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere', required: true } // [longitude, latitude]
  },
  address_text: { type: String, required: true }, // Human-readable address
  pay_rate_min: { type: Number, required: true },
  pay_rate_max: { type: Number, required: true },
  pay_type: {
    type: String,
    enum: ['Hourly', 'Fixed Price', 'Daily', 'Weekly', 'Monthly'],
    required: true,
  },
  application_deadline: { type: Date },
  required_skills: [{ type: String }],
  image_url: { type: String }, // Optional image for the job
  status: {
    type: String,
    enum: ['Active', 'Filled', 'Expired', 'Draft'],
    default: 'Active',
  },
}, { timestamps: true });

module.exports = mongoose.model('Job', JobSchema);