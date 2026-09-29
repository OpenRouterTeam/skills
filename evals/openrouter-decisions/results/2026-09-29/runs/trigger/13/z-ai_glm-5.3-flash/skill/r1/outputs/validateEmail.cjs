function validateEmail(email) {
  if (typeof email !== "string") {
    return false;
  }

  const value = email.trim();
  if (value.length < 6 || value.length > 254) {
    return false;
  }

  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === value.length - 1) {
    return false;
  }

  const localPart = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);

  if (localPart.includes("..") || domain.includes("..")) {
    return false;
  }

  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
    return false;
  }

  return /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(domain);
}

module.exports = validateEmail;
