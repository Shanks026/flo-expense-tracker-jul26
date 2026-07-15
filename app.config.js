const fs = require('fs');
const path = require('path');

// Single flag driving the two APK variants (auto-detect / no-detect) from
// one codebase — built via `eas build --profile lite` (FLO_VARIANT=lite,
// see eas.json) vs `--profile full` or any other profile/local dev, which
// all keep auto-detect on (the app's behavior before this split existed).
const AUTO_DETECT = process.env.FLO_VARIANT !== 'lite';

const AUTO_DETECT_MODULE = 'flo-notification-listener';

// expo-modules-autolinking resolves its `exclude` list from package.json's
// `expo.autolinking.exclude` at prebuild time — that's the ONLY thing that
// actually keeps the native FloNotificationListenerService (and the
// BIND_NOTIFICATION_LISTENER_SERVICE manifest entry it carries) out of the
// lite build's AndroidManifest.xml. Commenting out the JS call sites is not
// enough: the module's manifest fragment merges in via AGP's manifest
// merger the moment modules/flo-notification-listener is present and
// autolinked, regardless of whether any JS ever calls it. So this file
// rewrites package.json as a side effect, ahead of prebuild's native
// project generation, rather than only returning JS config. Idempotent —
// only touches the file when the exclude list actually needs to change, so
// a normal (non-lite) `expo start`/prebuild never dirties package.json.
function syncAutolinkingExclude() {
  const pkgPath = path.join(__dirname, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentExclude = pkg.expo?.autolinking?.exclude ?? [];
  const isExcluded = currentExclude.includes(AUTO_DETECT_MODULE);
  const shouldExclude = !AUTO_DETECT;
  if (isExcluded === shouldExclude) return;

  const nextExclude = shouldExclude
    ? [...currentExclude, AUTO_DETECT_MODULE]
    : currentExclude.filter((name) => name !== AUTO_DETECT_MODULE);

  if (nextExclude.length) {
    pkg.expo = { ...pkg.expo, autolinking: { ...(pkg.expo?.autolinking ?? {}), exclude: nextExclude } };
  } else if (pkg.expo?.autolinking) {
    // Nothing left to exclude — drop the (now-empty) autolinking key
    // entirely rather than leaving `{ autolinking: { exclude: [] } }`
    // sitting in package.json for every normal, non-lite build.
    const { autolinking, ...restExpo } = pkg.expo;
    if (Object.keys(restExpo).length) {
      pkg.expo = restExpo;
    } else {
      delete pkg.expo;
    }
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

syncAutolinkingExclude();

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    // Read via Constants.expoConfig.extra.autoDetectEnabled (lib/detect.js,
    // app/settings.js) to gate the JS side the same way the native side is
    // gated above — both must agree, or the lite build would either crash
    // on boot (JS tries to call a native module that isn't linked) or show
    // dead UI for a feature that can't work.
    autoDetectEnabled: AUTO_DETECT,
  },
});
