const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    employer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        required: [true, 'Please add a job title'],
        trim: true,
        maxlength: [100, 'Title can not be more than 100 characters'],
    },
    description: {
        type: String,
        required: [true, 'Please add a description'],
        maxlength: [1000, 'Description can not be more than 1000 characters'],
    },
    job_type: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Seasonal'],
        required: [true, 'Please select a job type'],
    },
    city: {
        type: String,
        required: [true, 'Please add a city'],
        trim: true,
    },
    // GeoJSON Point for location
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point', // Default to 'Point'
        },
        coordinates: {
            type: [Number], // Array of numbers [longitude, latitude]
            required: [true, 'Please add coordinates (longitude, latitude)'],
            index: '2dsphere' // This is crucial for geospatial queries
        },
        address_text: { // To store the human-readable address
            type: String,
            trim: true,
            required: false // Optional
        }
    },
    pay_rate_min: {
        type: Number,
        required: [true, 'Please add a minimum pay rate'],
        min: [0, 'Minimum pay rate cannot be negative'],
    },
    pay_rate_max: {
        type: Number,
        required: [true, 'Please add a maximum pay rate'],
        min: [0, 'Maximum pay rate cannot be negative'],
    },
    pay_type: {
        type: String,
        enum: ['Hourly', 'Fixed Price', 'Daily', 'Weekly', 'Monthly'],
        required: [true, 'Please select a pay type'],
    },
    application_deadline: {
        type: Date,
        default: null, // Optional
    },
    required_skills: {
        type: [String], // Array of strings
        default: [],
    },
    image_url: {
        type: String,
        default: '/uploads/geo_job_default.jpg', // Default image path for consistency
    },
    status: {
        type: String,
        enum: ['Active', 'Filled', 'Closed'], // Order adjusted for common usage
        default: 'Active',
    },
    posted_at: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('Job', JobSchema);
