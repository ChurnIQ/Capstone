const crypto = require('crypto');

const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 3;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashSecretValue(secret, value) {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

function hashesMatch(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validatePasswordStrength(password) {
  const value = String(password || '');
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter.';
  if (!/\d/.test(value)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include a special character.';
  return null;
}

function recordId(record) {
  return String(record?.id || record?._id || '');
}

function createPasswordResetService({
  userRepository,
  resetRepository,
  sendOtpEmail,
  hashSecret,
  now = () => new Date(),
  randomOtp = generateOtp,
  randomToken = () => crypto.randomBytes(32).toString('hex'),
} = {}) {
  if (!userRepository || !resetRepository || !sendOtpEmail || !hashSecret) {
    throw new Error('Password reset service dependencies are incomplete');
  }

  const hash = (value) => hashSecretValue(hashSecret, value);
  const currentTime = () => new Date(now());

  async function requestOtp(email) {
    const normalizedEmail = normalizeEmail(email);
    const user = await userRepository.findEligibleByEmail(normalizedEmail);

    if (!user) {
      hash(randomOtp());
      return { requestId: null, emailSent: false };
    }

    const createdAt = currentTime();
    await resetRepository.invalidateActiveForUser(user.id || user._id, createdAt);

    const otp = randomOtp();
    const record = await resetRepository.create({
      userId: user.id || user._id,
      email: normalizedEmail,
      otpHash: hash(otp),
      expiresAt: new Date(createdAt.getTime() + OTP_TTL_MS),
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      resendCount: 0,
      resendAvailableAt: new Date(createdAt.getTime() + RESEND_COOLDOWN_MS),
      consumedAt: null,
      verifiedAt: null,
    });

    try {
      await sendOtpEmail({ to: normalizedEmail, otp, expiresMinutes: 5 });
    } catch (error) {
      record.consumedAt = currentTime();
      await resetRepository.save(record);
      const deliveryError = new Error('Password reset email could not be sent');
      deliveryError.code = 'EMAIL_DELIVERY_FAILED';
      deliveryError.cause = error;
      throw deliveryError;
    }

    return { requestId: recordId(record), emailSent: true };
  }

  async function verifyOtp(requestId, otp) {
    const candidateHash = hash(String(otp || ''));
    const record = await resetRepository.findById(requestId);
    const time = currentTime();

    if (!record) return { ok: false, code: 'invalid' };
    if (record.consumedAt || record.verifiedAt || !record.otpHash) {
      return { ok: false, code: 'already_used' };
    }
    if (new Date(record.expiresAt) <= time) return { ok: false, code: 'expired' };
    if (record.attempts >= (record.maxAttempts || MAX_ATTEMPTS)) {
      return { ok: false, code: 'locked' };
    }

    if (!hashesMatch(candidateHash, record.otpHash)) {
      record.attempts += 1;
      await resetRepository.save(record);
      return {
        ok: false,
        code: record.attempts >= (record.maxAttempts || MAX_ATTEMPTS) ? 'locked' : 'invalid',
        attemptsRemaining: Math.max(0, (record.maxAttempts || MAX_ATTEMPTS) - record.attempts),
      };
    }

    const resetToken = randomToken();
    record.verifiedAt = time;
    record.otpHash = null;
    record.resetTokenHash = hash(resetToken);
    record.resetTokenExpiresAt = new Date(time.getTime() + RESET_TOKEN_TTL_MS);
    await resetRepository.save(record);

    return { ok: true, resetToken };
  }

  async function resendOtp(requestId) {
    const record = await resetRepository.findById(requestId);
    const time = currentTime();

    if (!record || record.consumedAt || record.verifiedAt) return { ok: false, code: 'invalid' };
    if (record.resendCount >= MAX_RESENDS) return { ok: false, code: 'resend_limit' };
    if (new Date(record.resendAvailableAt) > time) {
      return {
        ok: false,
        code: 'cooldown',
        retryAfterSeconds: Math.ceil((new Date(record.resendAvailableAt) - time) / 1000),
      };
    }

    const otp = randomOtp();
    await sendOtpEmail({ to: record.email, otp, expiresMinutes: 5 });

    record.otpHash = hash(otp);
    record.expiresAt = new Date(time.getTime() + OTP_TTL_MS);
    record.attempts = 0;
    record.resendCount += 1;
    record.resendAvailableAt = new Date(time.getTime() + RESEND_COOLDOWN_MS);
    await resetRepository.save(record);

    return { ok: true, resendCount: record.resendCount };
  }

  async function isResetAuthorized(requestId, resetToken) {
    const record = await resetRepository.findById(requestId);
    const time = currentTime();
    if (!record || record.consumedAt || !record.verifiedAt || !record.resetTokenHash) return false;
    if (!record.resetTokenExpiresAt || new Date(record.resetTokenExpiresAt) <= time) return false;
    return hashesMatch(hash(resetToken), record.resetTokenHash);
  }

  async function resetPassword(requestId, resetToken, newPassword) {
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) return { ok: false, code: 'weak_password', message: passwordError };

    const authorized = await isResetAuthorized(requestId, resetToken);
    if (!authorized) return { ok: false, code: 'invalid_authorization' };

    const record = await resetRepository.findById(requestId);
    const user = await userRepository.findById(record.userId);
    if (!user || !user.password) return { ok: false, code: 'invalid_authorization' };

    await userRepository.savePassword(user, newPassword);
    record.consumedAt = currentTime();
    record.resetTokenHash = null;
    record.resetTokenExpiresAt = null;
    await resetRepository.save(record);
    await userRepository.invalidateSessions(record.userId);

    return { ok: true };
  }

  return {
    requestOtp,
    verifyOtp,
    resendOtp,
    isResetAuthorized,
    resetPassword,
    validatePasswordStrength,
  };
}

module.exports = {
  createPasswordResetService,
  generateOtp,
  hashSecretValue,
  validatePasswordStrength,
  constants: {
    OTP_TTL_MS,
    RESET_TOKEN_TTL_MS,
    RESEND_COOLDOWN_MS,
    MAX_ATTEMPTS,
    MAX_RESENDS,
  },
};
