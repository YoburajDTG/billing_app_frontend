const { withProjectBuildGradle, withAppBuildGradle, withSettingsGradle, withGradleProperties } = require("@expo/config-plugins");
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin - THE NDK 26 + C++20 + PATCH MASTER FIX v26
 */
const withAndroidFixes = (config) => {
  const projectRoot = config._internal?.projectRoot || process.cwd();

  // 0. Nuclear Patching
  try {
    // A. Patch Legacy Printer
    const printerPath = path.resolve(projectRoot, 'node_modules/@brooons/react-native-bluetooth-escpos-printer/android');
    if (fs.existsSync(printerPath)) {
      const gPath = path.resolve(printerPath, 'build.gradle');
      const mPath = path.resolve(printerPath, 'src/main/AndroidManifest.xml');
      if (fs.existsSync(gPath)) {
        let c = fs.readFileSync(gPath, 'utf8');
        c = c.replace(/compileSdkVersion\s+\d+/g, 'compileSdkVersion 35');
        c = c.replace(/buildToolsVersion\s+['"].*['"]/g, 'buildToolsVersion "35.0.0"');
        if (!c.includes('namespace')) c = c.replace(/android\s*\{/, 'android {\n    namespace "cn.jystudio.bluetooth"');
        fs.writeFileSync(gPath, c);
      }
      if (fs.existsSync(mPath)) {
        let c = fs.readFileSync(mPath, 'utf8');
        c = c.replace(/package=".*?"/, '');
        fs.writeFileSync(mPath, c);
      }
    }

    // B. Patch React Native CORE - COMPREHENSIVE FIX for std::format
    const rnHeaderPath = path.resolve(projectRoot, 'node_modules/react-native/ReactCommon/react/renderer/core/graphicsConversions.h');
    if (fs.existsSync(rnHeaderPath)) {
      let c = fs.readFileSync(rnHeaderPath, 'utf8');
      if (c.includes('std::format(')) {
        console.log("Patching RN core headers...");
        c = c.replace(/std::format\("\{\}%", dimension\.value\)/g, 'std::to_string(dimension.value) + "%"');
        fs.writeFileSync(rnHeaderPath, c);
      }
    }
  } catch (e) { console.warn("Nuclear Patching failed:", e); }

  // 1. App Level Fix
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let b = config.modResults.contents;
      // Force C++20 across the project with NDK 26
      if (!b.includes('-std=c++20')) {
        b = b.replace(/defaultConfig\s*\{/, 'defaultConfig {\n        externalNativeBuild { cmake { arguments "-DCMAKE_CXX_FLAGS=-std=c++20" } }');
      }
      config.modResults.contents = b;
    }
    return config;
  });

  // 2. Project Level Fix
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      config.modResults.contents = `
buildscript {
    ext {
        compileSdkVersion = 35 
        targetSdkVersion = 34
        minSdkVersion = 24
        buildToolsVersion = "35.0.0"
        ndkVersion = "26.1.10909125" 
        kotlinVersion = "2.1.20"
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle")
        classpath("com.facebook.react:react-native-gradle-plugin")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin")
    }
}

apply plugin: "com.facebook.react.rootproject"

allprojects {
    repositories {
        maven { url 'https://www.jitpack.io' }
        google()
        mavenCentral()
    }
}

subprojects {
    def applyGlobalFix = { p ->
        if (p.hasProperty('android')) {
            p.android {
                ndkVersion "26.1.10909125"
                buildToolsVersion "35.0.0"
                
                compileOptions {
                    sourceCompatibility JavaVersion.VERSION_17
                    targetCompatibility JavaVersion.VERSION_17
                }
            }
            
            if (p.plugins.hasPlugin('com.android.library') || p.plugins.hasPlugin('com.android.application')) {
                p.android.defaultConfig {
                    externalNativeBuild {
                        cmake {
                            arguments "-DCMAKE_CXX_FLAGS=-std=c++20" // Use C++20 with patched headers
                        }
                    }
                }
            }
            
            if (p.android.hasProperty('namespace') && p.android.namespace == null) {
                p.android.namespace = "com.yoburaj.vegbillingapp." + p.name.replaceAll("-", "_")
            }
        }
    }
    if (project.state.executed) {
        applyGlobalFix(project)
    } else {
        project.afterEvaluate { applyGlobalFix(it) }
    }
}
`;
    }
    return config;
  });

  // 3. Settings Level
  config = withSettingsGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let c = config.modResults.contents;
      c = c.replace(/rootProject\.name\s*=\s*['"].*['"]/, "rootProject.name = 'suji-veg-billing'");
      config.modResults.contents = c;
    }
    return config;
  });

  // 4. Properties Level
  config = withGradleProperties(config, (config) => {
    const props = [
      { key: 'android.enableJetifier', value: 'true' },
      { key: 'android.useAndroidX', value: 'true' },
      { key: 'org.gradle.jvmargs', value: '-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8' },
      { key: 'systemProp.file.encoding', value: 'UTF-8' }
    ];
    props.forEach(pr => {
      const i = config.modResults.findIndex(x => x.key === pr.key);
      if (i > -1) config.modResults[i].value = pr.value;
      else config.modResults.push({ key: pr.key, value: pr.value });
    });
    return config;
  });

  return config;
};

module.exports = withAndroidFixes;
