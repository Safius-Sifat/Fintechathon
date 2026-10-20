import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Address, Hash } from "viem";
import { AccountsScreen } from "../screens/Accounts";
import { AgentControlScreen } from "../screens/AgentControl";
import { ContactsScreen } from "../screens/Contacts";
import { TxDetailScreen } from "../screens/TxDetail";
import {
  ConfirmPhraseScreen,
  CreatePhraseScreen,
  LockScreen,
  RestoreScreen,
  ShowPhraseScreen,
} from "../screens/wallet/Lifecycle";
import type { AdminCommandName } from "../wallet/core";
import { useWallet } from "../wallet/session";
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

// Root stack. Which screens exist depends on the wallet: none (first run),
// locked, or unlocked (the app).
export type RootStackParamList = {
  Welcome: undefined;
  Setup: undefined;
  CreatePhrase: undefined;
  ConfirmPhrase: undefined;
  Restore: undefined;
  Lock: undefined;
  ShowPhrase: undefined;
  Contacts: { pick?: boolean };
  TxDetail: { hash: Hash };
  AgentControl: { command: AdminCommandName; wallet: Address };
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
    label: "Wallet",
    icon: "wallet-outline",
    iconSelected: "wallet",
  },
  Agents: {
    label: "Agents",
    icon: "circle-double",
    iconSelected: "circle-double",
  },
  Activity: {
    label: "Activity",
    icon: "clock-outline",
    iconSelected: "clock",
  },
  Settings: {
    label: "Settings",
    icon: "tune-variant",
    iconSelected: "tune-variant",
  },
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

// Screens for the current wallet state. Changing state swaps the whole set,
// so Back never returns to onboarding or the lock screen.
export function RootNavigator() {
  const { status } = useWallet();
  if (status === "loading") return null;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status === "none" ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Setup" component={SetupScreen} />
          <Stack.Screen name="CreatePhrase" component={CreatePhraseScreen} />
          <Stack.Screen name="ConfirmPhrase" component={ConfirmPhraseScreen} />
          <Stack.Screen name="Restore" component={RestoreScreen} />
        </>
      ) : status === "locked" ? (
        <Stack.Screen name="Lock" component={LockScreen} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="Accounts" component={AccountsScreen} />
          <Stack.Screen name="Receive" component={ReceiveScreen} />
          <Stack.Screen name="Scan" component={ScanScreen} />
          <Stack.Screen name="Send" component={SendScreen} />
          <Stack.Screen
            name="TransferReview"
            component={TransferReviewScreen}
          />
          <Stack.Screen name="TxDetail" component={TxDetailScreen} />
          <Stack.Screen name="Contacts" component={ContactsScreen} />
          <Stack.Screen name="ShowPhrase" component={ShowPhraseScreen} />
          <Stack.Screen name="AgentControl" component={AgentControlScreen} />
          {__DEV__ ? (
            <>
              <Stack.Screen name="PreviewIndex" component={PreviewIndex} />
              <Stack.Screen name="Preview" component={PreviewScreen} />
            </>
          ) : null}
        </>
      )}
    </Stack.Navigator>
  );
}
