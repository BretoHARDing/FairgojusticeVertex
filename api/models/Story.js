/**
 * Story Model - Community story submissions
 */

const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'legal-costs',
      'evidence',
      'delays',
      'representation',
      'misconduct',
      'family-court',
      'whistleblower',
      'other'
    ]
  },
  story: {
    type: String,
    required: true,
    minLength: 50,
    maxLength: 10000
  },
  excerpt: {
    type: String,
    maxLength: 250
  },
  impact: {
    type: String,
    maxLength: 2000
  },
  reforms: {
    type: String,
    maxLength: 2000
  },
  privacy: {
    type: String,
    enum: ['public', 'anonymous', 'private'],
    default: 'anonymous'
  },
  displayName: {
    type: String,
    default: 'Anonymous'
  },
  contact: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'published', 'rejected'],
    default: 'pending'
  },
  moderatorNotes: {
    type: String
  },
  publishedAt: {
    type: Date
  },
  evidenceUrl: {
    type: String,
    trim: true
  },
  evidenceFilename: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
storySchema.index({ status: 1 });
storySchema.index({ category: 1 });
storySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Story', storySchema);
