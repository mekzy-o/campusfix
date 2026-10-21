/**
 * Optional e-mail delivery. When SMTP settings are present, notifications are
 * also e-mailed; otherwise e-mail is skipped silently and users still receive
 * the in-app notification.
 */
const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
if (config.smtp.host && !config.isTest) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

async function sendMail({ to, subject, text }) {
  if (!transporter || !to) return false;
  try {
    await transporter.sendMail({ from: config.smtp.from, to, subject, text });
    return true;
  } catch (err) {
    console.error('[mailer] failed to send e-mail:', err.message);
    return false;
  }
}

module.exports = { sendMail, isEnabled: () => Boolean(transporter) };
