// Postinstall: rewrite expo-share-intent's android/build.gradle to the
// `expo-module-gradle-plugin` form every other Expo module in this project
// uses (see 32-safe-closed-test-build.md, ticket 06).
//
// WHY: expo-share-intent (5.0.0 and 5.1.1 alike) still loads the core plugin
// the legacy way, `apply from: ExpoModulesCorePlugin.gradle`. On Gradle 8.14
// that fails at configuration with "Could not load compiled classes for script
// ExpoModulesCorePlugin.gradle from cache" (ClassNotFoundException), and
// clearing the Gradle caches doesn't help. The plugin form configures cleanly.
// The plugin also supplies the managed SDK versions and the core dependencies
// that the legacy helpers used to add.
//
// Idempotent and self-contained (no patch tool dependency). Drop it once
// expo-share-intent ships the plugin form itself.
const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, '..', 'node_modules', 'expo-share-intent', 'android', 'build.gradle');
const pkgPath = path.join(__dirname, '..', 'node_modules', 'expo-share-intent', 'package.json');

if (!fs.existsSync(gradlePath)) process.exit(0);

const current = fs.readFileSync(gradlePath, 'utf8');
if (!current.includes('ExpoModulesCorePlugin.gradle')) process.exit(0);

const version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

fs.writeFileSync(
  gradlePath,
  `plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

// Patched by scripts/patch-expo-share-intent.js (FLO).
android {
  namespace "expo.modules.shareintent"
  defaultConfig {
    versionCode 1
    versionName "${version}"
  }
  lintOptions {
    abortOnError false
  }
}
`
);
console.log(`[flo] patched expo-share-intent ${version} android/build.gradle to the expo-module-gradle-plugin form`);
