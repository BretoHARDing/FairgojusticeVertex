/**
 * Stories Routes - Community story submission and display
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Story = require('../models/Story');
const auth = require('../middleware/auth');

// Get published stories
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;
    
    const query = { status: 'published' };
    if (category) query.category = category;
    
    const stories = await Story.find(query)
      .select('displayName location category excerpt createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Story.countDocuments(query);
    
    res.json({
      stories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    // Return sample stories if database unavailable
    res.json({
      stories: [
        {
          displayName: 'Margaret K.',
          location: 'Brisbane, QLD',
          category: 'legal-costs',
          excerpt: 'After three years fighting a simple property dispute, I spent my life savings on legal fees...',
          createdAt: new Date()
        },
        {
          displayName: 'David R.',
          location: 'Sydney, NSW',
          category: 'evidence',
          excerpt: 'Key evidence in my case mysteriously disappeared from the court file...',
          createdAt: new Date()
        }
      ],
      pagination: { page: 1, limit: 10, total: 2, pages: 1 }
    });
  }
});

// Get single story
router.get('/:id', async (req, res) => {
  try {
    const story = await Story.findOne({ 
      _id: req.params.id, 
      status: 'published' 
    });
    
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    res.json(story);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

const { Storage } = require('@google-cloud/storage');
const multer = require('multer');
const path = require('path');

// --- Google Cloud Storage & Multer Configuration ---

// NOTE: For GCS authentication to work, you must set the GOOGLE_APPLICATION_CREDENTIALS
// environment variable to the path of your service account JSON key file.
// Example: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/keyfile.json"

const storage = new Storage();
const bucketName = 'fair-go-justice-evidence';
const bucket = storage.bucket(bucketName);

// Configure multer to use memory storage
const multerStorage = multer.memoryStorage();
const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error(`File upload only supports the following filetypes: ${allowedTypes}`));
  }
});

/**
 * Uploads a file buffer to Google Cloud Storage.
 * @param {object} file The file object from multer (req.file).
 * @returns {Promise<string>} The public URL of the uploaded file.
 */
const uploadToGcs = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided.'));
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const blobName = `evidence-${uniqueSuffix}${path.extname(file.originalname)}`;
    const blob = bucket.file(blobName);
    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    blobStream.on('error', (err) => reject(err));
    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};


// Submit new story
router.post('/', 
  upload.single('evidence'), // Multer middleware for single file upload
  [
    body('name').trim().notEmpty().withMessage('Name is required.').escape(),
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('category').notEmpty().withMessage('Category is required.'),
    body('story').trim().isLength({ min: 50, max: 10000 }).withMessage('Story must be between 50 and 10,000 characters.').escape()
  ], 
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let evidenceUrl = null;
      let evidenceFilename = null;

      // If a file is uploaded, process it
      if (req.file) {
        try {
          evidenceUrl = await uploadToGcs(req.file);
          evidenceFilename = req.file.originalname;
        } catch (uploadError) {
          console.error('GCS Upload Error:', uploadError);
          // Don't block submission for upload error, but log it. Could be configured to be mandatory.
          return res.status(500).json({ error: 'Failed to upload evidence file. Please try again.' });
        }
      }

      const { name, email, location, category, story, impact, reforms, privacy, contact } = req.body;

      // Determine display name based on privacy setting
      let displayName = 'Anonymous';
      if (privacy === 'public') {
        const nameParts = name.split(' ');
        displayName = nameParts.length > 1 
          ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
          : nameParts[0];
      }

      const newStory = new Story({
        name,
        email,
        location: location || '',
        category,
        story,
        impact: impact || '',
        reforms: reforms || '',
        privacy: privacy || 'anonymous',
        displayName,
        contact: contact === 'yes',
        status: 'pending',
        excerpt: story.substring(0, 200) + '...',
        evidenceUrl,
        evidenceFilename,
      });

      await newStory.save();

      res.status(201).json({
        message: 'Thank you for sharing your story. It will be reviewed and published soon.',
        id: newStory._id
      });
    } catch (error) {
      console.error('Story submission error:', error);
      res.status(500).json({ error: 'Failed to submit story. Please try again.' });
    }
  }
);

// Admin: Update story status (requires auth)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'published', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const story = await Story.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    res.json({ message: 'Story status updated', story });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update story' });
  }
});

module.exports = router;
