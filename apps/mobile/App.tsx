import {
  DefaultTheme,
  NavigationContainer,
  type InitialState,
  type Theme,
} from "@react-navigation/native";
import {
  Newsreader_500Medium,
  Newsreader_600SemiBold,
} from "@expo-google-fonts/newsreader";
import { useFonts } from "expo-font";
import { useEffect, useMemo, useRef } from "react";
import { AppState, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { clearAllDrafts } from "./src/state/sendDraft";
import { useColors } from "./src/theme";
import { useAutomaticSignIn } from "./src/wallet/api";
import { loadWallet, lock } from "./src/wallet/session";

// Background time after which the wallet locks itself.
const LOCK_AFTER_MS = 60_000;

export default function App() {
  useAutomaticSignIn();
  const colors = useColors();
  const navigationTheme = useMemo<Theme>(
    () => ({
      ...DefaultTheme,
      dark: colors.statusBar === "light",
      colors: {
        ...DefaultTheme.colors,
        background: colors.ground,
        card: colors.raised,
        border: colors.rule,
        text: colors.ink,
        primary: colors.ink,
      },
    }),
    [colors],
  );
  // Headings render in the system serif until the bundled font is ready, so a
  // font error never blocks the app.
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_500Medium,
    Newsreader_600SemiBold,
  });
  // Remount the navigation tree when the system font size changes: tabs that
  // are mounted but hidden are not re-laid out by the native side and would
  // keep text measured at the old size. Navigation state is carried over, so
  // the user stays on the same tab. Native side: plugins/withFontScaleLayout.js.
  const { fontScale } = useWindowDimensions();
  const navigationState = useRef<InitialState | undefined>(undefined);
  useEffect(() => {
    loadWallet();
    let leftAt = 0;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") leftAt = Date.now();
      if (next === "active" && leftAt && Date.now() - leftAt > LOCK_AFTER_MS) {
        clearAllDrafts();
        lock();
      }
    });
    return () => sub.remove();
  }, []);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={
          colors.statusBar === "light" ? "light-content" : "dark-content"
        }
      />
      <NavigationContainer
        key={fontScale}
        theme={navigationTheme}
        initialState={navigationState.current}
        onStateChange={(state) => {
          navigationState.current = state;
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
