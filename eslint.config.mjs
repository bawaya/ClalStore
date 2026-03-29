import nextConfig from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextConfig,
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "off",
    },
  },
  {
    ignores: ["node_modules/", ".next/", "out/", "public/sw.js"],
  },
];

export default config;
