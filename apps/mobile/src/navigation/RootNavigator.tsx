import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AccountsScreen } from "../screens/Accounts";
import { PreviewIndex, PreviewScreen } from "../screens/preview";
import { AgentsScreen } from "../screens/AgentsScreen";
import { ActivityScreen } from "../screens/ActivityScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { SetupScreen, WelcomeScreen } from "../screens/Onboarding";
import { ReceiveScreen } from "../screens/Receive";
import { ScanScreen } from "../screens/Scan";
import { SendScreen } from "../screens/Send";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TransferReviewScreen } from "../screens/TransferReview";
import { TabBar, type TabMeta } from "./TabBar";

export type TabParamList = {
  Home: undefined;
  Agents: undefined;
  Activity: undefined;
  Settings: undefined;
};

// Root stack: the first-run flow, then the tabs. Full-screen flows (Receive,
// Send, details) are pushed over the tabs in later milestones.
export type RootStackParamList = {
  Welcome: undefined;
  Setup: undefined;
  Tabs: NavigatorScreenParams<TabParamList>;
  Accounts: undefined;
  Receive: undefined;
  Scan: undefined;
  Send: undefined;
  // Reads the Send draft from state/sendDraft.ts.
  TransferReview: undefined;
  // Development builds only: sample-data design preview.
  PreviewIndex: undefined;
  Preview: { id: string };
};

const TAB_META: Record<keyof TabParamList, TabMeta> = {
  Home: {
    label: "Home",
    icon: "home-variant-outline",
    iconSelected: "home-variant",
  },
  Agents: {
    label: "Agents",
    icon: "robot-outline",
    iconSelected: "robot",
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
      <Tab.Screen name="Agents" component={AgentsScreen} />
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
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="Receive" component={ReceiveScreen} />
      <Stack.Screen name="Scan" component={ScanScreen} />
      <Stack.Screen name="Send" component={SendScreen} />
      <Stack.Screen name="TransferReview" component={TransferReviewScreen} />
      {__DEV__ ? (
        <>
          <Stack.Screen name="PreviewIndex" component={PreviewIndex} />
          <Stack.Screen name="Preview" component={PreviewScreen} />
        </>
      ) : null}
    </Stack.Navigator>
  );
}
