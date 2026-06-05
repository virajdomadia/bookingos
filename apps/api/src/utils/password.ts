import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  // Check minimum length
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain an uppercase letter (A-Z)" };
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain a lowercase letter (a-z)" };
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain a number (0-9)" };
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      valid: false,
      error: "Password must contain a special character (!@#$%^&* etc.)",
    };
  }

  // Reject repeated characters (aaa, 111, etc.)
  if (/(.)\1{2,}/.test(password)) {
    return { valid: false, error: "Password cannot contain 3+ repeated characters" };
  }

  // Reject common patterns
  if (/^(?:password|admin|123456|qwerty|letmein)/i.test(password)) {
    return { valid: false, error: "Password cannot contain common patterns" };
  }

  // Reject sequential characters
  if (/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i.test(password)) {
    return { valid: false, error: "Password cannot contain sequential characters" };
  }

  return { valid: true };
};
