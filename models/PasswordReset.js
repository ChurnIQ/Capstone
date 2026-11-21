const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otpHash: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 5,
  },
  resendCount: {
    type: Number,
    default: 0,
  },
  resendAvailableAt: {
    type: Date,
    required: true,
  },
  verifiedAt: Date,
  resetTokenHash: String,
  resetTokenExpiresAt: Date,
  consumedAt: Date,
}, {
  timestamps: true,
});

// Retain expired records briefly for safe expired/used responses, then remove
// them automatically. No plaintext OTP or reset token is ever persisted.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
passwordResetSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.models.PasswordReset
  || mongoose.model('PasswordReset', passwordResetSchema);
