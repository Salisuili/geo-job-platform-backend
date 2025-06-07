// local-labor-backend/models/Rating.js
const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema({
  rater_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // The user who gives the rating
    required: true,
  },
  target_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // The user who receives the rating (laborer or employer)
    required: true,
  },
  job_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job', // The job associated with this rating (optional if general user rating)
    required: false, // Make false if ratings can be given outside specific job context
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true,
  },
  comment: { type: String, maxlength: 500 },
}, { timestamps: true });

module.exports = mongoose.model('Rating', RatingSchema);