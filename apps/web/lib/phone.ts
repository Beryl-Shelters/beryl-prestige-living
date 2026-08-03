export const normalizePhone = (raw: string) => {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("234")) return `+${compact}`;
  if (compact.startsWith("0")) return `+234${compact.slice(1)}`;
  return `+234${compact}`;
};

export const isValidPhone = (value: string) => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
