import nextConfig from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextConfig,
  {
    rules: {
      "no-unused-vars": "off",
      "no-console": ["warn", { allow: ["warn", "error", "log"] }],
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-img-element": "off",
    },
  },
  {
    ignores: ["node_modules/", ".next/", "out/", "public/sw.js"],
  },
];

export default config;
