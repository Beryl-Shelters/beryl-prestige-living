const maxMinor = 999999999999999n;

export function nairaToKobo(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return minor <= maxMinor ? Number(minor) : null;
}

export function formatMoneyInput(value: string): string | null {
  const normalized = value.replace(/,/g, "");
  if (!/^\d{0,13}(\.\d{0,2})?$/.test(normalized)) return null;
  const [whole = "", fraction] = normalized.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export { formatMoneyInput as formatNairaInput };

export function moneyInputFromMinor(value: number): string {
  return formatMoneyInput(`${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`) ?? "";
}

export function formatNaira(value: number, decimals = false): string {
  const minor = BigInt(Math.round(value));
  const suffix = decimals || minor % 100n ? `.${(minor % 100n).toString().padStart(2, "0")}` : "";
  return `₦${new Intl.NumberFormat("en-NG").format(Number(minor / 100n))}${suffix}`;
}
