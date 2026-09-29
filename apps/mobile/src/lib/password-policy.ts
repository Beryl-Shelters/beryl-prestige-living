// Mirrors the API policy; API regression tests check these messages and rules
// together. Login deliberately does not apply new-password requirements.
export function passwordValidationErrors(password: string, confirmation: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push("The password field must be at least 8 characters.");
  if (password.length > 128) errors.push("The password field must be at most 128 characters.");
  if (!/[A-Z]/.test(password)) errors.push("The password field must contain at least one uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("The password field must contain at least one lowercase letter.");
  if (!/[A-Za-z]/.test(password)) errors.push("The password field must contain at least one letter.");
  if (!/[^\p{L}\p{N}\s]/u.test(password)) errors.push("The password field must contain at least one symbol.");
  if (password !== confirmation) errors.push("Passwords do not match.");
  return errors;
}

export function validateNewPassword(password: string, confirmation: string): void {
  const errors = passwordValidationErrors(password, confirmation);
  if (errors.length) throw new Error(errors.join(" "));
}
