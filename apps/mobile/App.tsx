import {
  DefaultTheme,
  NavigationContainer,
  type InitialState,
  type Theme,
} from "@react-navigation/native";
import { useRef } from "react";
import { StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { colors } from "./src/theme";

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.hairline,
    text: colors.text,
    primary: colors.personal,
  },
};

export default function App() {
  // Remount the navigation tree when the system font size changes: tabs that
  // are mounted but hidden are not re-laid out by the native side and would
  // keep text measured at the old size. Navigation state is carried over, so
  // the user stays on the same tab. Native side: plugins/withFontScaleLayout.js.
  const { fontScale } = useWindowDimensions();
  const navigationState = useRef<InitialState | undefined>(undefined);
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
