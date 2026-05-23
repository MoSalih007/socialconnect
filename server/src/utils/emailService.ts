import nodemailer from 'nodemailer';

// Prevent XSS in email templates — usernames could contain malicious HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string
): Promise<void> {
  const transporter = createTransporter();
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  const safeUsername = escapeHtml(username);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '✅ Verify Your SocialConnect Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>🎉 Welcome to SocialConnect!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi <strong>${safeUsername}</strong>,</p>
          <p>Thanks for signing up! Click below to verify your email:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p>Or copy this link: <code>${verificationUrl}</code></p>
          <p><small>Link expires in 24 hours.</small></p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  username: string,
  token: string
): Promise<void> {
  const transporter = createTransporter();
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const safeUsername = escapeHtml(username);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '🔒 Reset Your SocialConnect Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ef4444; color: white; padding: 30px; text-align: center;">
          <h1>🔒 Password Reset</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px;">
          <p>Hi <strong>${safeUsername}</strong>,</p>
          <p>Click below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #ef4444; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p><small>Link expires in 1 hour.</small></p>
        </div>
      </div>
    `,
  });
}

export async function send2FACodeEmail(
  email: string,
  username: string,
  code: string
): Promise<void> {
  const transporter = createTransporter();
  const safeUsername = escapeHtml(username);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '🔐 Your SocialConnect Login Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a6e 0%, #4a148c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>🔐 Two-Factor Authentication</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi <strong>${safeUsername}</strong>,</p>
          <p>Your login verification code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #1a1a6e; color: white; font-size: 32px; letter-spacing: 8px; padding: 20px 40px; display: inline-block; border-radius: 10px; font-weight: bold;">
              ${code}
            </div>
          </div>
          <p style="color: #666;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #999;"><small>If you didn't attempt to log in, someone may be trying to access your account. Consider changing your password immediately.</small></p>
        </div>
      </div>
    `,
  });
}


export async function sendEmailChangeOTP(
  newEmail: string,
  username: string,
  code: string
): Promise<void> {
  const transporter = createTransporter();
  const safeUsername = escapeHtml(username);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: newEmail,
    subject: '📧 Confirm Your New Email — SocialConnect',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #00d4ff 0%, #00FFD1 100%); color: #1a1a2e; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>📧 Email Change Verification</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi <strong>${safeUsername}</strong>,</p>
          <p>You requested to change your email to this address. Enter the code below to confirm:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #0d9488; color: white; font-size: 32px; letter-spacing: 8px; padding: 20px 40px; display: inline-block; border-radius: 10px; font-weight: bold;">
              ${code}
            </div>
          </div>
          <p style="color: #666;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #999;"><small>If you didn't request this change, please ignore this email.</small></p>
        </div>
      </div>
    `,
  });
}
