import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const appRoot = path.resolve(__dirname, "..");
const source = (file: string) => readFileSync(path.join(appRoot, "src", file), "utf8");

describe("light mobile appearance architecture", () => {
  const appConfig = JSON.parse(readFileSync(path.join(appRoot, "app.json"), "utf8")) as {
    expo: {
      userInterfaceStyle: string;
      icon: string;
      ios: { bundleIdentifier: string };
      android: { package: string; adaptiveIcon?: { foregroundImage: string; backgroundColor: string } };
    };
  };

  it("keeps the app light and preserves platform identities", () => {
    expect(appConfig.expo.userInterfaceStyle).toBe("light");
    expect(appConfig.expo.android.package).toBe("com.berylshelter.mobile");
    expect(appConfig.expo.ios.bundleIdentifier).toBe("com.berylshelter.mobile");
  });

  it("uses official launcher and adaptive icon assets", () => {
    const adaptiveIcon = appConfig.expo.android.adaptiveIcon;
    expect(appConfig.expo.icon).toBe("./assets/brand/launcher-icon.png");
    expect(adaptiveIcon).toEqual({ foregroundImage: "./assets/brand/launcher-adaptive-foreground.png", backgroundColor: "#FFFDF8" });
    expect(existsSync(path.join(appRoot, appConfig.expo.icon))).toBe(true);
    expect(existsSync(path.join(appRoot, adaptiveIcon!.foregroundImage))).toBe(true);
  });

  it("uses explicit readable shared input colors", () => {
    const tokens = source("theme/tokens.ts");
    const ui = source("components/ui.tsx");
    ["inputText", "inputPlaceholder", "inputBackground", "inputBorder", "inputDisabledText", "inputDisabledBackground", "selectionColor"].forEach((token) => expect(tokens).toContain(token));
    expect(ui).toContain("placeholderTextColor={colors.inputPlaceholder}");
    expect(ui).toContain("selectionColor={colors.selectionColor}");
    expect(ui).toContain("cursorColor={colors.selectionColor}");
    expect(ui).toContain("color:colors.inputText");
    expect(tokens).not.toMatch(/inputPlaceholder:\s*["']#fff(?:fff)?["']/i);
  });

  it("keeps shared field styling on auth and onboarding screens", () => {
    expect(source("components/signup-form.tsx")).toContain("<TextField");
    expect(source("components/customer-auth.tsx")).toContain("<TextField");
    const onboarding = source("components/onboarding.tsx");
    expect(onboarding).toContain("placeholderTextColor={colors.inputPlaceholder}");
    expect(onboarding).toContain("colors.inputBackground");
    expect(onboarding).toContain("colors.inputText");
    expect(source("components/verify-email.tsx")).toContain("colors.inputBackground");
  });

  it("keeps keyboard-controller configuration and a light status bar", () => {
    const layout = readFileSync(path.join(appRoot, "app", "_layout.tsx"), "utf8");
    expect(layout).toContain("KeyboardProvider");
    expect(layout).toContain('<StatusBar style="dark"');
  });
});
