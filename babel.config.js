module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          alias: {
            "@": "./src",
            "@assets": "./src/assets",
          },
        },
      ],      
      // Worklets plugin already wraps Reanimated’s plugin; avoid duplicates
      "react-native-worklets/plugin",
    ],
  };
};
