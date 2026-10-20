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
import { useRef } from "react";
import { StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { colors } from "./src/theme";

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.ground,
    card: colors.raised,
    border: colors.rule,
    text: colors.ink,
    primary: colors.ink,
  },
};

export default function App() {
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
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
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
