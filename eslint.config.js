// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // server/ (Cloudflare Worker) and admin/ (admin website) are separate projects with their own tsconfig.
    ignores: ["dist/*", "server/*", "admin/*"],
  }
]);
