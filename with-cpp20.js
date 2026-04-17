const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to add C++20 flags to build.gradle
 */
const withCpp20 = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      const buildGradle = config.modResults.contents;
      
      // Check if it already exists to avoid duplicates
      if (!buildGradle.includes('cppFlags "-std=c++20"')) {
        const searchPattern = /defaultConfig\s*\{/;
        const replacement = `defaultConfig {
        externalNativeBuild {
            cmake {
                cppFlags "-std=c++20"
            }
        }`;
        
        config.modResults.contents = buildGradle.replace(searchPattern, replacement);
      }
    }
    return config;
  });
};

module.exports = withCpp20;
