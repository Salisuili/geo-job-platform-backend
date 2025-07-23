require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const jobRoutes = require('./routes/jobRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const laborerRoutes = require('./routes/laborerRoutes');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// IMPORTANT: This line allows serving static files (your uploaded images and documents)
// It will serve files from 'uploads/' and its subdirectories like 'uploads/job_images/' and 'uploads/applications_docs/'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/laborers', laborerRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});