const tokens = require("./src/shared/ui/tokens.json");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // app.json fixes the app to light mode; NativeWind's default "media" mode then errors on web.
  darkMode: "class",
  theme: {
    extend: {
      colors: tokens.colors,
      // One family per weight: custom fonts on native don't synthesise weights.
      fontFamily: Object.fromEntries(Object.entries(tokens.fonts).map(([key, family]) => [key, [family]])),
    },
  },
  plugins: [],
};
