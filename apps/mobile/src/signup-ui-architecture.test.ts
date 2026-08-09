import { readFileSync } from "node:fs";
import path from "node:path";
const source=(file:string)=>readFileSync(path.resolve(__dirname,file),"utf8");
describe("signup mobile UI regressions",()=>{
  it("uses red, blue and green password state tokens with matching copy",()=>{const ui=source("components/ui.tsx");const tokens=source("theme/tokens.ts");expect(tokens).toContain("passwordWeak");expect(tokens).toContain("passwordModerate");expect(tokens).toContain("passwordStrong");expect(ui).toContain('label:"Weak"');expect(ui).toContain('label:"Moderate"');expect(ui).toContain('label:"Strong"');expect(ui).toContain("Great job! This password is strong and secure.");});
  it("uses the keyboard-controller long-form shell",()=>{const ui=source("components/ui.tsx");const layout=source("../app/_layout.tsx");expect(ui).toContain("KeyboardAwareScrollView");expect(ui).toContain("bottomOffset={20}");expect(ui).toContain("extraKeyboardSpace={20}");expect(ui).toContain('keyboardShouldPersistTaps="handled"');expect(ui).toContain("flexGrow:1");expect(layout).toContain("KeyboardProvider");});
  it("makes only the signup Log in text interactive and brown",()=>{const signup=source("components/signup-form.tsx");expect(signup).toContain('accessibilityLabel="Log in"');expect(signup).toContain('router.push("/login")');expect(signup).toContain('color:colors.ink');expect(signup).toContain('color:colors.brown');});
});
