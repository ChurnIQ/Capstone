const nodemailer = require('nodemailer');

function smtpConfigFromEnv(env = process.env) {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = required.filter((name) => !env[name]?.trim());

  if (missing.length > 0) {
    const error = new Error(`SMTP is not configured (${missing.join(', ')} missing)`);
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  return {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: String(env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  };
}

function createEmailService({ env = process.env, transporter } = {}) {
  let mailer = transporter;

  function getTransporter() {
    if (!mailer) mailer = nodemailer.createTransport(smtpConfigFromEnv(env));
    return mailer;
  }

  async function sendPasswordResetOtp({ to, otp, expiresMinutes = 5 }) {
    const from = env.SMTP_FROM?.trim();
    if (!from) {
      const error = new Error('SMTP_FROM is not configured');
      error.code = 'SMTP_NOT_CONFIGURED';
      throw error;
    }

    await getTransporter().sendMail({
      from,
      to,
      subject: 'Your ChurnIQ password reset code',
      text: `Your ChurnIQ password reset code is ${otp}. It expires in ${expiresMinutes} minutes. If you did not request this, you can ignore this email.`,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#333">
          <h2 style="color:#667eea">Reset your ChurnIQ password</h2>
          <p>Use this verification code to continue:</p>
          <div style="font-size:32px;letter-spacing:8px;font-weight:700;padding:18px 22px;background:#f3f1ff;border-radius:12px;text-align:center">${otp}</div>
          <p>This code expires in ${expiresMinutes} minutes and can be used only once.</p>
          <p style="color:#777;font-size:13px">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });
  }

  return { sendPasswordResetOtp };
}

module.exports = {
  createEmailService,
  smtpConfigFromEnv,
};
