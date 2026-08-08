import { signupSchema } from "./signup";
describe("mobile signup schema", () => {
  const valid = { gettingStartedAs: "FIND_PROPERTY", fullName: "Amina Bello", email: "amina@example.com", phone: "0801 234 5678", isWhatsAppNumber: true, password: "Password123!", confirmPassword: "Password123!" };
  it("normalizes a Nigerian phone and accepts Buyer intent", () => expect(signupSchema.parse(valid).phone).toBe("+2348012345678"));
  it("accepts Seller intent", () => expect(signupSchema.parse({ ...valid, gettingStartedAs: "LIST_PROPERTY" }).gettingStartedAs).toBe("LIST_PROPERTY"));
  it("requires a separate WhatsApp number when requested", () => expect(() => signupSchema.parse({ ...valid, isWhatsAppNumber: false })).toThrow());
  it("rejects mismatched passwords without submitting", () => expect(() => signupSchema.parse({ ...valid, confirmPassword: "Different123!" })).toThrow("Passwords do not match"));
});
