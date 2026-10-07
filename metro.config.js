const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// The Worker in server/ has its own dependencies; keep Metro from crawling them.
config.resolver.blockList = [new RegExp(`^${path.resolve(__dirname, "server").replace(/[/\\]/g, "[/\\\\]")}[/\\\\].*`)];

module.exports = withNativeWind(config, { input: "./src/global.css" });
