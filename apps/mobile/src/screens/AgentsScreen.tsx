import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/Button";
import { GhostButton } from "../components/blocks";
import {
  AgentMessage,
  CardLine,
  Composer,
  Suggestions,
  TextLink,
  ThreadCard,
  UserBubble,
} from "../components/chat";
import { Icon } from "../components/Icon";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { agentLine, describeRequest, readRequest } from "../state/agentThread";
import type { BrowserForm } from "../state/taskModels";
import { useServicePoll } from "../state/useServicePoll";
import { radius, space, type, makeStyles, useColors } from "../theme";
import {
  createTask,
  getTask,
  registeredServiceWallet,
  serviceTaskReferences,
  useApiSession,
} from "../wallet/api";
import { agentWallet } from "../wallet/chain";
import { TOKENS } from "../wallet/config";
import { formatAmount } from "../wallet/format";
import { currentAccount, useWallet } from "../wallet/session";
import { errorText, useAsync } from "../wallet/useAsync";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STARTERS = [
  "Check that the checkout page loads",
  "Check the checkout form submits",
  "Test the broken checkout page",
] as const;

// The agent tab is a conversation: you ask in plain words, the agent reads the
// request back, and each task continues in its own thread.
export function AgentsScreen() {
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  useWallet();
  const account = currentAccount();
  const api = useApiSession();
  const chain = useAsync(
    () => (account ? agentWallet(account.address) : Promise.resolve(null)),
    [account?.address],
  );
  const service = useServicePoll(
    registeredServiceWallet,
    "service-wallet",
    10000,
  );
  const refs = useServicePoll(serviceTaskReferences, "known-tasks", 10000);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<
    { text: string; form: BrowserForm } | { text: string; error: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  const w = service.data;
  const ready = !!api && w?.provisioningState === "READY";
  const tasks = (refs.data ?? [])
    .filter((t) => t.walletId === w?.walletId)
    .slice(0, 5)
    .reverse();

  const send = (value: string) => {
    setError(null);
    try {
      setDraft({ text: value, form: readRequest(value) });
    } catch (e) {
      setDraft({ text: value, error: errorText(e) });
    }
  };
  const start = async () => {
    if (!draft || !("form" in draft) || !w || busy) return;
    setBusy(true);
    setError(null);
    try {
      const task = await createTask({
        walletId: w.walletId,
        runbookId: "browser-check",
        goal: draft.text,
        input: { ...draft.form },
      });
      setDraft(null);
      refs.reload();
      navigation.navigate("TaskDetail", { taskId: task.taskId });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const balance = chain.data
    ? `${formatAmount(chain.data.balances[0]!, TOKENS[0]!.decimals)} DUSD`
    : "Wallet";
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Agent
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Agent wallet, ${balance}`}
          onPress={() => navigation.navigate("AgentWallet")}
          style={({ pressed }) => [
            styles.walletPill,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="wallet-outline" size={18} color={colors.primary} />
          <Text style={styles.walletText}>
            {chain.data?.paused
              ? "Paused"
              : chain.data?.frozen
                ? "Frozen"
                : balance}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.thread}
        onContentSizeChange={() => scroll.current?.scrollToEnd()}
      >
        {!api ? (
          <AgentMessage text="Sign in to the Mandate service in Settings, and I can run tasks for you.">
            <GhostButton
              label="Open Settings"
              onPress={() =>
                navigation.navigate("Tabs", { screen: "Settings" })
              }
            />
          </AgentMessage>
        ) : !ready ? (
          <AgentMessage
            text={
              service.loading
                ? "Checking your agent wallet…"
                : w
                  ? "Your agent wallet is still being set up. I'll be ready when it is."
                  : "I need an agent wallet before I can pay for anything. Set one up first."
            }
          >
            {!service.loading ? (
              <GhostButton
                label="Set up the agent wallet"
                onPress={() => navigation.navigate("AgentWallet")}
              />
            ) : null}
          </AgentMessage>
        ) : (
          <AgentMessage text="Tell me what to check. I'll show you the plan and ask before I spend anything." />
        )}

        {tasks.map((t) => (
          <View key={t.taskId} style={styles.turn}>
            <UserBubble>{t.goal}</UserBubble>
            <TaskLine
              taskId={t.taskId}
              onOpen={() =>
                navigation.navigate("TaskDetail", { taskId: t.taskId })
              }
            />
          </View>
        ))}

        {draft ? (
          <View style={styles.turn}>
            <UserBubble>{draft.text}</UserBubble>
            {"error" in draft ? (
              <AgentMessage text={draft.error} />
            ) : (
              <AgentMessage text="Here's what I'll do. Nothing is paid until you approve the spending.">
                <ThreadCard>
                  <Text style={styles.cardTitle}>
                    {describeRequest(draft.form)}
                  </Text>
                  <CardLine
                    label="Paid attempts"
                    value={`Up to ${draft.form.maxPaidAttempts}`}
                  />
                  <CardLine label="Finish within" value="1 hour" />
                  <PrimaryButton
                    label={busy ? "Starting…" : "Start this task"}
                    disabled={busy}
                    onPress={start}
                  />
                  <TextLink
                    label="Change the details"
                    onPress={() =>
                      w &&
                      navigation.navigate("TaskCreate", {
                        walletId: w.walletId,
                      })
                    }
                  />
                </ThreadCard>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </AgentMessage>
            )}
          </View>
        ) : ready && tasks.length === 0 ? (
          <Suggestions items={STARTERS} onPick={setText} />
        ) : null}
      </ScrollView>
      <View style={styles.composerWrap}>
        <Composer
          placeholder={
            ready ? "Ask your agent to check a page" : "Agent not ready"
          }
          value={text}
          onChange={setText}
          onSend={ready ? send : undefined}
          onPlus={
            ready && w
              ? () =>
                  navigation.navigate("TaskCreate", { walletId: w.walletId })
              : undefined
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// The agent's one-line status under an earlier request, from the service.
function TaskLine({ taskId, onOpen }: { taskId: string; onOpen: () => void }) {
  const task = useServicePoll(() => getTask(taskId), `line:${taskId}`, 10000);
  return (
    <AgentMessage
      text={
        task.data
          ? agentLine(task.data)
          : task.error
            ? "I can't read this task right now."
            : "Loading…"
      }
    >
      <TextLink label="Open task" onPress={onOpen} />
    </AgentMessage>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.ground },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  title: { ...type.hero, color: colors.ink },
  walletPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  walletText: { ...type.bodyStrong, color: colors.primary },
  scroll: { flex: 1 },
  thread: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.xxl,
  },
  turn: { gap: space.md },
  cardTitle: { ...type.heading, color: colors.ink },
  error: { ...type.body, color: colors.bad },
  composerWrap: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  pressed: { opacity: 0.8 },
}));
