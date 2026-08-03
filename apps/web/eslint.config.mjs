import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // React Hook Form exposes subscription APIs that the compiler cannot memoize.
      "react-hooks/incompatible-library": "off",
      // Hydration from session storage and reset-key controlled OTP state are intentional.
      "react-hooks/set-state-in-effect": "off"
    }
  },
  globalIgnores([".next/**", "coverage/**", "next-env.d.ts"])
]);
