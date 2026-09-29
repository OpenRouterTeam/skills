/**
 * Return whether a value is a valid, practical email address for signup.
 *
 * This deliberately validates the common email shape rather than attempting
 * to implement the full RFC grammar. Delivery confirmation should still be
 * used when an address must be verified.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidEmail(value) {
  if (typeof value !== 'string') return false;

  const email = value.trim();
  if (email.length === 0 || email.length > 254) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export { isValidEmail };
