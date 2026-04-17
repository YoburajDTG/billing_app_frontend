const { withProjectBuildGradle, withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to fix C++20 flags and SDK version mismatches
 */
const withAndroidFixes = (config) => {
  // 1. Fix C++ Flags in app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      const buildGradle = config.modResults.contents;
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

  // 2. Force SDK versions in project/build.gradle for old libraries (like the printer)
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;
      
      const forceSdkBlock = `
allprojects {
    each { project ->
        if (project.hasProperty('android')) {
            project.android {
                if (compileSdkVersion < 34) {
                    compileSdkVersion 34
                }
                if (buildToolsVersion < "34.0.0") {
                    buildToolsVersion "34.0.0"
                }
                defaultConfig {
                    if (targetSdkVersion < 34) {
                        targetSdkVersion 34
                    }
                }
            }
        }
    }
}
`;
      if (!contents.includes("allprojects {")) {
          contents += forceSdkBlock;
      } else if (!contents.includes("compileSdkVersion 34")) {
          // Add inside existing allprojects or at the end
          contents += forceSdkBlock;
      }
      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
};

module.exports = withAndroidFixes;
