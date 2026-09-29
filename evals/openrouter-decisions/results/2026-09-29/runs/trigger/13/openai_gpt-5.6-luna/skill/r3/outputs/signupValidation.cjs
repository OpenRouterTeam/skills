/**
 * Return whether a value is suitable for the signup form's email field.
 *
 * This intentionally performs basic client-side validation; the server should
 * still validate the address and verify ownership of it.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidEmail(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const email = value.trim();

  if (email.length === 0 || email.length > 254) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { isValidEmail };
