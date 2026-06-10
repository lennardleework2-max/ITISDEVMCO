// Input validation and sanitization utilities

// Sanitize string input - remove HTML tags and trim
function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate task/assignee status
const VALID_STATUSES = ['Pending', 'In Progress', 'Completed'];

function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}

// Validate password strength (minimum 6 characters)
function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

// Validate required fields are present
function validateRequired(obj, fields) {
  const missing = [];
  for (const field of fields) {
    if (!obj[field] || (typeof obj[field] === 'string' && !obj[field].trim())) {
      missing.push(field);
    }
  }
  return missing;
}

// Escape HTML for safe display
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = {
  sanitizeString,
  isValidEmail,
  isValidStatus,
  isValidPassword,
  validateRequired,
  escapeHtml,
  VALID_STATUSES
};
