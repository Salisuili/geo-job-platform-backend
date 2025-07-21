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
  city: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // Array of numbers, [longitude, latitude]
      required: true,
      index: '2dsphere' // Essential for geospatial queries
    },
    // ADDED: Field to store the human-readable address from geocoding
    address_text: {
      type: String,
      required: false, // Optional, but highly recommended
      trim: true
    }
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
    type: [String],
    default: [],
  },
  image_url: {
    type: String,
    trim: true,
    // REMOVED: The 'match' regex validator. It's no longer just a user-provided URL.
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