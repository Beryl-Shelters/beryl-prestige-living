const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

/**
 * Normalizes Nigerian local numbers by default while preserving explicit
 * international numbers. Validation is deliberately separate from formatting.
 */
export const normalizePhone = (value: string) => {
  const compact = value.trim().replace(/[\s().-]/g, "");

  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("234")) return `+${compact}`;
  if (compact.startsWith("0")) return `+234${compact.slice(1)}`;

  return `+234${compact}`;
};

export const isE164Phone = (value: string) => E164_PATTERN.test(value);
