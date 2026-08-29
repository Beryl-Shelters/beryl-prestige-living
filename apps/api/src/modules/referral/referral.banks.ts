export const REFERRAL_BANK_DIRECTORY = [
  ["044", "Access Bank"], ["023", "Citibank Nigeria"], ["050", "Ecobank Nigeria"],
  ["070", "Fidelity Bank"], ["011", "First Bank of Nigeria"], ["214", "First City Monument Bank"],
  ["00103", "Globus Bank"], ["058", "Guaranty Trust Bank"], ["030", "Heritage Bank"],
  ["301", "Jaiz Bank"], ["082", "Keystone Bank"], ["50211", "Kuda Microfinance Bank"],
  ["090405", "Moniepoint Microfinance Bank"], ["999992", "OPay"], ["999991", "PalmPay"],
  ["076", "Polaris Bank"], ["101", "Providus Bank"], ["221", "Stanbic IBTC Bank"],
  ["068", "Standard Chartered Bank Nigeria"], ["232", "Sterling Bank"], ["100", "SunTrust Bank"],
  ["000026", "TAJBank"], ["102", "Titan Trust Bank"], ["032", "Union Bank of Nigeria"],
  ["033", "United Bank for Africa"], ["035", "Wema Bank"], ["057", "Zenith Bank"]
].map(([code, name]) => ({ code, name }));

export const referralBankByCode = (code: string) =>
  REFERRAL_BANK_DIRECTORY.find((bank) => bank.code === code);
