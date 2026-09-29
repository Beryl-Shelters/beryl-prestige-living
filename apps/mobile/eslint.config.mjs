import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import { configs as typescriptConfigs } from "typescript-eslint";

export default defineConfig([
  { ignores: ["dist/**", ".expo/**", ".expo-export/**", ".expo-web/**", "coverage/**"] },
  ...expoConfig,
  ...typescriptConfigs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
]);
