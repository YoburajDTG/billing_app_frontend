const { withProjectBuildGradle, withAppBuildGradle, withSettingsGradle, withGradleProperties } = require("@expo/config-plugins");

/**
 * Expo Config Plugin - THE ABSOLUTE ULTIMATE FIX
 */
const withAndroidFixes = (config) => {
  // 1. C++20 Fix
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let buildGradle = config.modResults.contents;
      if (!buildGradle.includes('cppFlags "-std=c++20"')) {
        const searchPattern = /defaultConfig\s*\{/;
        const replacement = `defaultConfig {
        externalNativeBuild { cmake { cppFlags "-std=c++20" } }`;
        buildGradle = buildGradle.replace(searchPattern, replacement);
      }
      config.modResults.contents = buildGradle;
    }
    return config;
  });

  // 2. SDK 34 + Java 17 + AndroidX Force Fix
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;
      const forceSdkBlock = `
/** FORCE FIX **/
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
            project.configurations.all {
                resolutionStrategy.force 'androidx.core:core:1.12.0'
                resolutionStrategy.force 'androidx.appcompat:appcompat:1.6.1'
            }
        }
    }
}
`;
      if (!contents.includes("/** FORCE FIX **/")) { contents += forceSdkBlock; }
      config.modResults.contents = contents;
    }
    return config;
  });

  // 3. Project Name Fix
  config = withSettingsGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;
      contents = contents.replace(/rootProject\.name\s*=\s*['"].*['"]/, "rootProject.name = 'suji-veg-billing'");
      config.modResults.contents = contents;
    }
    return config;
  });

  // 4. JETIFIER FIX (Crucial for old libraries)
  config = withGradleProperties(config, (config) => {
    config.modResults.push({ type: 'property', key: 'android.enableJetifier', value: 'true' });
    return config;
  });

  return config;
};

module.exports = withAndroidFixes;
