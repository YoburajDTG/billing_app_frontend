const { withProjectBuildGradle, withAppBuildGradle, withSettingsGradle } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to fix C++20 flags, SDK versions, and Tamil name encoding issues
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

  // 2. Force SDK versions for all subprojects safely
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;
      const forceSdkBlock = `
/** FORCE SDK FIXES **/
subprojects {
    afterEvaluate { project ->
        if (project.hasProperty('android')) {
            project.android {
                compileSdkVersion 34
                buildToolsVersion "34.0.0"
                defaultConfig { targetSdkVersion 34 }
                compileOptions {
                    sourceCompatibility JavaVersion.VERSION_17
                    targetCompatibility JavaVersion.VERSION_17
                }
            }
        }
    }
}
`;
      if (!contents.includes("FORCE SDK FIXES")) {
          contents += forceSdkBlock;
      }
      config.modResults.contents = contents;
    }
    return config;
  });

  // 3. Fix Tamil Name Encoding issues in settings.gradle
  config = withSettingsGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;
      // Replace any rootProject.name line with a safe English version for the build system
      contents = contents.replace(/rootProject\.name\s*=\s*['"].*['"]/, "rootProject.name = 'suji-veg-billing'");
      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
};

module.exports = withAndroidFixes;
