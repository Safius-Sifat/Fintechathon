import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { TransferAsset, TransferSource } from "../config/transfer";
import { AccountsScreen } from "../screens/Accounts";
import { ActivityScreen } from "../screens/ActivityScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { IntroScreen, SetupScreen, WelcomeScreen } from "../screens/Onboarding";
import { ReceiveScreen } from "../screens/Receive";
import { ScanScreen } from "../screens/Scan";
import { SendScreen } from "../screens/Send";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TransferReviewScreen } from "../screens/TransferReview";
import { TabBar, type TabMeta } from "./TabBar";

export type TabParamList = {
  Home: undefined;
  Activity: undefined;
  Settings: undefined;
};

// Root stack: the first-run flow, then the tabs. Full-screen flows (Receive,
// Send, details) are pushed over the tabs in later milestones.
export type RootStackParamList = {
  Welcome: undefined;
  Intro: undefined;
  // direct: opened from Welcome, skipping How it works.
  Setup: { direct?: boolean } | undefined;
  Tabs: NavigatorScreenParams<TabParamList>;
  Accounts: undefined;
  Receive: undefined;
  Scan: undefined;
  Send: undefined;
  TransferReview: {
    source: TransferSource;
    asset: TransferAsset;
    recipient: string;
    amount: string;
  };
};

const TAB_META: Record<keyof TabParamList, TabMeta> = {
  Home: {
    label: "Home",
    icon: "home-variant-outline",
    iconSelected: "home-variant",
  },
  Activity: {
    label: "Activity",
    icon: "clock-time-four-outline",
    iconSelected: "clock-time-four",
  },
  Settings: { label: "Settings", icon: "cog-outline", iconSelected: "cog" },
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  return (
    <Tab.Navigator
      // Android back from Activity/Settings returns to Home; back on Home
      // leaves the app.
      backBehavior="firstRoute"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} meta={TAB_META} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// No build can create a wallet yet, so every launch starts at Welcome.
// Leaving onboarding resets the stack, so Android back on Home exits the app.
export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Intro" component={IntroScreen} />
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="Receive" component={ReceiveScreen} />
      <Stack.Screen name="Scan" component={ScanScreen} />
      <Stack.Screen name="Send" component={SendScreen} />
      <Stack.Screen name="TransferReview" component={TransferReviewScreen} />
    </Stack.Navigator>
  );
}
