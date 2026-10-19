import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityScreen } from "../screens/ActivityScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TabBar, type TabMeta } from "./TabBar";

export type TabParamList = {
  Home: undefined;
  Activity: undefined;
  Settings: undefined;
};

// Root stack: full-screen flows (Receive, Send, details) are pushed over the
// tabs in later milestones.
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
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

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
    </Stack.Navigator>
  );
}
