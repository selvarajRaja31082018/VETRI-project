'use strict';

const nodemailer = require('nodemailer');
const env = require('../config/env');
const ApiError = require('./ApiError');
const logger = require('./logger');

/**
 * Outbound mail.
 *
 * Optional by design: the application runs perfectly well with no SMTP
 * configured, and the visitor-pass email simply reports itself unavailable.
 * Credentials are read from the environment only - nothing is ever hard-coded,
 * and the password is never logged or returned in a response.
 */

let transport = null;

/** True when enough SMTP settings are present to attempt a send. */
function isConfigured() {
  return Boolean(env.smtp.host);
}

function getTransport() {
  if (!isConfigured()) {
    throw ApiError.unprocessable(
      'Email is not configured on this server. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and MAIL_FROM.',
    );
  }

  // Built once and reused: nodemailer pools connections per transport.
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      // Some relays (and most local test servers) accept unauthenticated mail.
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
    });
  }
  return transport;
}

/**
 * Send one message. Returns the provider's message id so the caller can log or
 * surface it; never returns transport internals.
 */
async function sendMail({ to, subject, html, text, attachments }) {
  const mailer = getTransport();
  try {
    const info = await mailer.sendMail({
      from: env.smtp.from,
      to,
      subject,
      text,
      html,
      attachments,
    });
    logger.info(`Mail sent to ${to} (${info.messageId})`);
    return { messageId: info.messageId };
  } catch (error) {
    // The SMTP error can carry credentials or host detail - log it, but hand
    // the caller a message that is safe to show an operator.
    logger.error('Failed to send mail', error.message);
    throw ApiError.unprocessable('Could not send the email. Check the address and try again.');
  }
}

/** Test hook: drop the cached transport so config changes take effect. */
function resetTransport() {
  transport = null;
}

module.exports = { sendMail, isConfigured, resetTransport };
