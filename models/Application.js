const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    job_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
    },
    applicant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Refers to the User model for the laborer
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Reviewed', 'Interview Scheduled', 'Accepted', 'Rejected'],
        default: 'Pending',
    },
    // NEW FIELDS FOR RESUME AND COVER LETTER
    resume_url: {
        type: String,
        required: [true, 'Resume is required for application'],
    },
    cover_letter_url: {
        type: String,
        // Making cover letter optional, adjust as per your requirement
        required: false,
    },
    // You might also want to add a field for the actual application text/notes from laborer
    // application_notes: {
    //     type: String,
    //     maxlength: 2000,
    // }
}, {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
});

// Add a unique compound index to prevent duplicate applications for the same job by the same laborer
applicationSchema.index({ job_id: 1, applicant_id: 1 }, { unique: true });

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;