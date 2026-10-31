import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Photos are served through short-lived Supabase signed URLs, which
      // cannot go through the next/image optimizer cache. Plain <img> is intended.
      "@next/next/no-img-element": "off",
      // react-hook-form's watch() is intentionally used; the React Compiler is not enabled.
      "react-hooks/incompatible-library": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "lib/database.types.ts", "supabase/**", "scripts/**"]),
]);

export default eslintConfig;
