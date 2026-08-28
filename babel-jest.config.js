/**
 * Babel для jest: пресет React Native без плагина Reanimated.
 *
 * Тесты проверяют чистую логику ядра, а worklet-директивы в Node остаются
 * строками — поднимать RN-рантайм и UI-поток для этого не нужно.
 */
module.exports = {
  presets: ["module:@react-native/babel-preset"],
};
