export const numericDigits = (value: string) => value.replace(/\D/g, "");

export const formatNumericInput = (value: string | number | null | undefined) => {
  const digits = numericDigits(value === null || value === undefined ? "" : String(value));
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const numericInputValue = (value: string) => {
  const digits = numericDigits(value);
  return digits ? Number(digits) : null;
};
