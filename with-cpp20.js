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

  // 2. Force SDK versions for all subprojects using afterEvaluate
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;
      
      const forceSdkBlock = `
subprojects {
    afterEvaluate { project ->
        if (project.hasProperty('android')) {
            project.android {
                compileSdkVersion 34
                buildToolsVersion "34.0.0"
                defaultConfig {
                    targetSdkVersion 34
                }
                // Force Java 17 for all modules to support modern compilation
                compileOptions {
                    sourceCompatibility JavaVersion.VERSION_17
                    targetCompatibility JavaVersion.VERSION_17
                }
            }
        }
    }
}
`;
      // Clean up previous attempts if they exist
      contents = contents.replace(/allprojects\s*\{\s*each\s*\{\s*project\s*->[\s\S]*?\}\s*\}/g, "");
      
      if (!contents.includes("subprojects {")) {
          contents += forceSdkBlock;
      }
      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
};

module.exports = withAndroidFixes;
