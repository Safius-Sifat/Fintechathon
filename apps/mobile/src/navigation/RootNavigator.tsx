import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AccountsScreen } from "../screens/Accounts";
import { AgentControlsScreen } from "../screens/AgentControls";
import { AgentTasksScreen } from "../screens/AgentTasks";
import { AlertsScreen } from "../screens/Alerts";
import { AllowanceApprovalScreen } from "../screens/AllowanceApproval";
import { ApprovalScreen } from "../screens/Approval";
import { ApprovalDetailScreen } from "../screens/ApprovalDetail";
import { ApprovalsScreen } from "../screens/Approvals";
import { ActivityScreen } from "../screens/ActivityScreen";
import { AssetsScreen } from "../screens/Assets";
import { ControlScreen } from "../screens/Control";
import { HomeScreen } from "../screens/HomeScreen";
import { InspectorScreen } from "../screens/Inspector";
import { IntentComposeScreen } from "../screens/IntentCompose";
import { IntentReviewScreen } from "../screens/IntentReview";
import { IntroScreen, SetupScreen, WelcomeScreen } from "../screens/Onboarding";
import { ReceiveScreen } from "../screens/Receive";
import { RecoveryScreen } from "../screens/Recovery";
import { ScanScreen } from "../screens/Scan";
import { ScheduleScreen } from "../screens/Schedule";
import { SendScreen } from "../screens/Send";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TaskScreen } from "../screens/Task";
import { TaskCreateScreen } from "../screens/TaskCreate";
import { TokenDetailsScreen } from "../screens/TokenDetails";
import { TransactionDetailScreen } from "../screens/TransactionDetail";
import { TransferReviewScreen } from "../screens/TransferReview";
import { WalletPolicyScreen } from "../screens/WalletPolicy";
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
  // Reads the Send draft from state/sendDraft.ts.
  TransferReview: undefined;
  // Development samples only until real history exists.
  TransactionDetail: { sampleId: string };
  Assets: undefined;
  TokenDetails: { token: "ETH" | "DemoUSD" | "sample" };
  AgentTasks: undefined;
  // The two forms read their drafts from state/taskDraft.ts.
  TaskCreate: undefined;
  Schedule: undefined;
  Approval: { kind: "browser" | "schedule" };
  // Development samples only until real tasks exist.
  Task: { sampleId: string };
  Inspector: { sampleId: string };
  Approvals: undefined;
  // Development samples only until real requests exist.
  ApprovalDetail: { sampleId: string };
  Alerts: undefined;
  AgentControls: undefined;
  // The policy, intent and allowance screens read their drafts from
  // state/{policyDraft,intentDraft,taskDraft}.ts.
  WalletPolicy: undefined;
  IntentCompose: undefined;
  IntentReview: undefined;
  AllowanceApproval: undefined;
  Control: undefined;
  Recovery: undefined;
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
      <Stack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
      />
      <Stack.Screen name="Assets" component={AssetsScreen} />
      <Stack.Screen name="TokenDetails" component={TokenDetailsScreen} />
      <Stack.Screen name="AgentTasks" component={AgentTasksScreen} />
      <Stack.Screen name="TaskCreate" component={TaskCreateScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="Approval" component={ApprovalScreen} />
      <Stack.Screen name="Task" component={TaskScreen} />
      <Stack.Screen name="Inspector" component={InspectorScreen} />
      <Stack.Screen name="Approvals" component={ApprovalsScreen} />
      <Stack.Screen name="ApprovalDetail" component={ApprovalDetailScreen} />
      <Stack.Screen name="Alerts" component={AlertsScreen} />
      <Stack.Screen name="AgentControls" component={AgentControlsScreen} />
      <Stack.Screen name="WalletPolicy" component={WalletPolicyScreen} />
      <Stack.Screen name="IntentCompose" component={IntentComposeScreen} />
      <Stack.Screen name="IntentReview" component={IntentReviewScreen} />
      <Stack.Screen
        name="AllowanceApproval"
        component={AllowanceApprovalScreen}
      />
      <Stack.Screen name="Control" component={ControlScreen} />
      <Stack.Screen name="Recovery" component={RecoveryScreen} />
    </Stack.Navigator>
  );
}
