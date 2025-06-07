const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  employer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  job_type: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Seasonal'],
    required: true,
  },
  // MODIFIED: Store the city provided by the employer
  city: {
    type: String,
    required: true,
    trim: true,
  },
  // Keep the GeoJSON 'location' for geospatial queries.
  // This will be populated by the backend using a geocoding service.
  location: {
    type: {
      type: String,
      enum: ['Point'], // 'location.type' must be 'Point'
      required: true,
    },
    coordinates: {
      type: [Number], // Array of numbers, [longitude, latitude]
      required: true,
      index: '2dsphere' // Essential for geospatial queries
    },
  },
  pay_rate_min: {
    type: Number,
    required: true,
    min: 0,
  },
  pay_rate_max: {
    type: Number,
    required: true,
    min: 0,
  },
  pay_type: {
    type: String,
    enum: ['Hourly', 'Fixed Price', 'Daily', 'Weekly', 'Monthly'],
    required: true,
  },
  application_deadline: {
    type: Date,
  },
  required_skills: {
    type: [String], // Array of strings
    default: [],
  },
  image_url: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/, 'Please use a valid image URL'],
  },
  status: {
    type: String,
    enum: ['Active', 'Closed', 'Filled'],
    default: 'Active',
  },
  posted_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Job', jobSchema);