// local-labor-backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT tokens

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Will store hashed password
    full_name: { type: String, required: true },
    user_type: {
        type: String,
        enum: ['laborer', 'employer', 'admin'],
        required: true,
    },
    phone_number: { type: String },
    profile_picture_url: { type: String, default: 'https://via.placeholder.com/150' },
    
    // --- NEW FIELD ADDED ---
    city: { type: String }, 
    // This stores the human-readable city name captured by the frontend.
    
    // For Laborer specific fields (only if user_type is 'laborer')
    bio: { type: String },
    hourly_rate: { type: Number },
    is_available: { type: Boolean, default: true },
    skills: [{ type: String }],
    
    // Geospatial location for laborers (GeoJSON Point)
    current_location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        // IMPORTANT: The index MUST be defined OUTSIDE the field definition.
        coordinates: { type: [Number] } // Removed index definition here
    },
    
    // For Employer specific fields (only if user_type is 'employer')
    company_name: { type: String },
    company_description: { type: String },
}, { timestamps: true });


UserSchema.index({ current_location: '2dsphere' }); 


// --- Password Hashing Middleware (pre-save hook) ---
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// --- Method to compare passwords ---
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// --- Method to generate JWT ---
UserSchema.methods.generateAuthToken = function () {
    const token = jwt.sign(
        {
            _id: this._id,
            user_type: this.user_type,
            username: this.username,
            email: this.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' } // Token expires in 1 hour
    );
    return token;
};

module.exports = mongoose.model('User', UserSchema);