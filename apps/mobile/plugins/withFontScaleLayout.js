// Makes a system font-size change apply while the app is running.
//
// 1. Turns on React Native's `enableFontScaleChangesUpdatingLayout` feature
//    flag (off by default in RN 0.81.5), so ReactHost refreshes display
//    metrics and re-lays out text on a configuration change. Every other flag
//    keeps RN's own Stable values: the provider delegates to
//    ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android, constructed with
//    the same arguments as DefaultNewArchitectureEntryPoint.load(). The call
//    runs right after loadReactNative(), before the React host is created.
// 2. Adds `fontScale` to MainActivity's configChanges. Otherwise Android
//    recreates the activity, the handler in (1) never runs, text keeps the old
//    scale and the screen's navigation state is lost.
// 3. Emits `didUpdateDimensions` from MainActivity.onConfigurationChanged (after
//    super, which refreshes the metrics) so JS sees the new fontScale. RN only
//    emits it on resume, and with (2) the activity is not paused.
const {
  AndroidConfig,
  withAndroidManifest,
  withMainActivity,
  withMainApplication,
} = require("expo/config-plugins");

const MARKER = "// mandate: enable font scale layout updates";
const ANCHOR = "loadReactNative(this)";
const IMPORTS = [
  "import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags",
  "import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android",
  "import com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider",
];
const CALL = `
    ${MARKER}
    if (DefaultNewArchitectureEntryPoint.releaseLevel == ReleaseLevel.STABLE) {
      val stable = ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android(
          fabricEnabled = true, bridgelessEnabled = true, turboModulesEnabled = true)
      ReactNativeFeatureFlags.dangerouslyForceOverride(
          object : ReactNativeFeatureFlagsProvider by stable {
            override fun enableFontScaleChangesUpdatingLayout(): Boolean = true
          })
    }`;

function withFontScaleFlag(config) {
  return withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error("withFontScaleLayout: expected MainApplication.kt");
    }
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;
    if (!src.includes(ANCHOR)) {
      throw new Error(`withFontScaleLayout: "${ANCHOR}" not found`);
    }
    src = src.replace(ANCHOR, ANCHOR + CALL);
    src = src.replace(/^(package [^\n]+\n)/, `$1\n${IMPORTS.join("\n")}\n`);
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withFontScaleConfigChange(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(
      cfg.modResults,
    );
    const changes = (activity.$["android:configChanges"] ?? "")
      .split("|")
      .filter(Boolean);
    if (!changes.includes("fontScale")) changes.push("fontScale");
    activity.$["android:configChanges"] = changes.join("|");
    return cfg;
  });
}

const ACTIVITY_MARKER = "// mandate: report font scale changes to JS";
const ACTIVITY_IMPORTS = [
  "import android.content.res.Configuration",
  "import android.view.View",
  "import android.view.ViewGroup",
  "import android.view.ViewTreeObserver",
  "import com.facebook.react.ReactRootView",
  "import com.facebook.react.uimanager.DisplayMetricsHolder",
];
// The React root only passes the font scale to Fabric's layout from onMeasure,
// which a font change alone does not trigger, so requestLayout() forces it.
// JS is told only after that layout pass: if JS re-renders first, new text is
// measured with the old scale.
const ACTIVITY_METHOD = `
  ${ACTIVITY_MARKER}
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    val decor = window.decorView
    decor.viewTreeObserver.addOnGlobalLayoutListener(
        object : ViewTreeObserver.OnGlobalLayoutListener {
          override fun onGlobalLayout() {
            decor.viewTreeObserver.removeOnGlobalLayoutListener(this)
            emitDimensions(newConfig.fontScale)
          }
        })
    requestReactRootLayout(decor)
  }

  private fun emitDimensions(fontScale: Float) {
    val context = reactHost?.currentReactContext ?: return
    if (context.hasActiveReactInstance()) {
      context.emitDeviceEvent(
          "didUpdateDimensions",
          DisplayMetricsHolder.getDisplayMetricsWritableMap(fontScale.toDouble()))
    }
  }

  private fun requestReactRootLayout(view: View) {
    if (view is ReactRootView) {
      view.requestLayout()
    } else if (view is ViewGroup) {
      for (i in 0 until view.childCount) requestReactRootLayout(view.getChildAt(i))
    }
  }
`;

function withFontScaleEvent(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error("withFontScaleLayout: expected MainActivity.kt");
    }
    let src = cfg.modResults.contents;
    if (src.includes(ACTIVITY_MARKER)) return cfg;
    if (src.includes("fun onConfigurationChanged")) {
      throw new Error(
        "withFontScaleLayout: MainActivity already overrides onConfigurationChanged",
      );
    }
    const end = src.lastIndexOf("}");
    src = src.slice(0, end) + ACTIVITY_METHOD + src.slice(end);
    src = src.replace(
      /^(package [^\n]+\n)/,
      `$1\n${ACTIVITY_IMPORTS.join("\n")}\n`,
    );
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withFontScaleLayout(config) {
  return withFontScaleEvent(
    withFontScaleConfigChange(withFontScaleFlag(config)),
  );
};
