const path = require("path");
const { getConfig } = require("react-native-builder-bob/babel-config");
const pkg = require("../package.json");

const root = path.resolve(__dirname, "..");

module.exports = getConfig(
  {
    presets: ["module:@react-native/babel-preset"],
    // Плагин worklets обязан идти последним: он собирает функции, помеченные
    // «worklet», в код для UI-потока.
    plugins: ["react-native-worklets/plugin"],
  },
  { root, pkg },
);
