import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GhostButton } from "../components/blocks";
import {
  AgentMessage,
  Composer,
  NowLine,
  Suggestions,
  UserBubble,
} from "../components/chat";
import { Icon } from "../components/Icon";
import { MandateMark } from "../components/MandateMark";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { canStop, nowDoing } from "../state/agentThread";
import { useConversation } from "../state/chat";
import { chatTitle, type ChatCard, type Turn } from "../state/chatThread";
import { useServicePoll } from "../state/useServicePoll";
import { radius, space, type, makeStyles, useColors } from "../theme";
import {
  createConversation,
  getTask,
  listConversations,
  registeredServiceWallet,
  sendMessage,
  useApiSession,
} from "../wallet/api";
import { agentWallet } from "../wallet/chain";
import { TOKENS } from "../wallet/config";
import { formatAmount } from "../wallet/format";
import type { TaskView } from "../wallet/service-dto/api";
import { currentAccount, useWallet } from "../wallet/session";
import { errorText, useAsync } from "../wallet/useAsync";
import {
  CheckCard,
  ErrorLine,
  OrderCard,
  ProductRow,
  QuestionChips,
  Thinking,
  WorkingSteps,
} from "./agent/cards";
import { HistoryDrawer } from "./agent/HistoryDrawer";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const EXAMPLES = [
  "Find running shoes under 0.40 USDC",
  "Show me trail shoes in size 43",
  "Check that the checkout page loads",
  "Test the broken checkout page",
] as const;

const USDC = TOKENS.findIndex((t) => t.symbol === "USDC");

// The agent tab is a chat, as in other agent apps: ask in plain words, the
// agent searches and shows what it found, and anything that spends opens an
// approval you sign. Earlier chats are in the history drawer.
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
  const history = useServicePoll(listConversations, "conversations", 15000);
  const [chatId, setChatId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [text, setText] = useState("");
  // Your message until the service has stored it.
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const chat = useConversation(chatId);
  const scroll = useRef<ScrollView>(null);
  const atBottom = useRef(true);

  const w = service.data;
  const ready = !!api && w?.provisioningState === "READY";
  const taskIds = chat.turns.flatMap((t) =>
    t.kind === "agent"
      ? t.cards.flatMap((c) =>
          c.kind === "purchase" || c.kind === "task" ? [c.taskId] : [],
        )
      : [],
  );
  const tasks = useServicePoll(
    async () =>
      new Map(
        await Promise.all(
          taskIds.map(async (id) => [id, await getTask(id)] as const),
        ),
      ),
    `chat-tasks:${taskIds.join(",")}`,
    taskIds.length ? 5000 : 0,
  );
  const taskMap = tasks.data ?? new Map<string, TaskView>();
  const stoppable = [...taskMap.values()].some(canStop);
  const doing =
    [...taskMap.values()].map((t) => nowDoing(t)).find(Boolean) ?? null;

  useEffect(() => {
    if (
      outgoing &&
      chat.events.some((e) => e.type === "user" && e.text === outgoing)
    )
      setOutgoing(null);
  }, [chat.events, outgoing]);

  const send = async (value: string) => {
    if (!w || outgoing) return;
    setSendError(null);
    setOutgoing(value);
    atBottom.current = true;
    try {
      if (chatId) await chat.send(value, null);
      else {
        const created = await createConversation(w.walletId);
        setChatId(created.conversationId);
        await sendMessage(created.conversationId, value, null);
      }
      history.reload();
    } catch (e) {
      setOutgoing(null);
      setText(value);
      setSendError(errorText(e));
    }
  };
  const openChat = (id: string | null) => {
    setDrawer(false);
    setChatId(id);
    setOutgoing(null);
    setSendError(null);
    atBottom.current = true;
  };
  const openTask = (taskId: string) =>
    navigation.navigate("TaskDetail", { taskId });
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottom.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
  };

  const balance = chain.data
    ? `${formatAmount(chain.data.balances[USDC] ?? 0n, 6)} USDC`
    : "Wallet";
  const current = history.data?.find((c) => c.conversationId === chatId);
  const busy = chat.replying || !!outgoing;
  const blocked = !api
    ? "Sign in to use the agent"
    : !ready
      ? "Agent wallet not ready"
      : chatId && chat.error && !chat.events.length
        ? "This chat can't be loaded"
        : null;
  const lastTurn = chat.turns.at(-1);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chats"
          onPress={() => {
            setDrawer(true);
            history.reload();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="menu" size={24} color={colors.ink} />
          {history.data?.some(
            (c) => c.status === "needs_you" && c.conversationId !== chatId,
          ) ? (
            <View style={styles.badge} accessibilityLabel="A chat needs you" />
          ) : null}
        </Pressable>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {current ? chatTitle(current) : chatId ? "Chat" : "Agent"}
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
          <Icon name="wallet-outline" size={16} color={colors.primary} />
          <Text style={styles.walletText}>
            {chain.data?.paused
              ? "Paused"
              : chain.data?.frozen
                ? "Frozen"
                : balance}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New chat"
          accessibilityState={{ disabled: !chatId }}
          disabled={!chatId}
          onPress={() => openChat(null)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.headerButton,
            !chatId && styles.off,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="square-edit-outline" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.thread}
        onScroll={onScroll}
        scrollEventThrottle={64}
        onContentSizeChange={() => {
          if (atBottom.current) scroll.current?.scrollToEnd();
        }}
      >
        {!chatId && !outgoing ? (
          <View style={styles.welcome}>
            <MandateMark size={48} />
            <Text style={styles.welcomeTitle}>What can I do for you?</Text>
            <Text style={styles.welcomeText}>
              I can shop the Mandate Test Shop and run paid page checks with
              your agent wallet. I ask before I spend anything.
            </Text>
            {!api ? (
              <GhostButton
                label="Sign in from Settings"
                onPress={() =>
                  navigation.navigate("Tabs", { screen: "Settings" })
                }
              />
            ) : !ready ? (
              service.loading ? null : (
                <GhostButton
                  label="Set up the agent wallet"
                  onPress={() => navigation.navigate("AgentWallet")}
                />
              )
            ) : (
              <View style={styles.examples}>
                <Text style={styles.examplesTitle}>Try</Text>
                <Suggestions items={EXAMPLES} onPick={setText} />
              </View>
            )}
          </View>
        ) : null}

        {chat.loading ? (
          <AgentMessage>
            <Thinking />
          </AgentMessage>
        ) : null}

        {chat.turns.map((turn) => (
          <TurnView
            key={turn.key}
            turn={turn}
            latest={turn === lastTurn && !busy}
            tasks={taskMap}
            onSend={ready ? send : undefined}
            onOpenTask={openTask}
          />
        ))}

        {outgoing ? (
          <>
            <UserBubble>{outgoing}</UserBubble>
            <AgentMessage>
              <Thinking />
            </AgentMessage>
          </>
        ) : null}

        {chatId && chat.error ? <ErrorLine message={chat.error} /> : null}
        {sendError ? <ErrorLine message={sendError} /> : null}
      </ScrollView>

      <View style={styles.composerWrap}>
        {doing ? <NowLine text={doing} /> : null}
        <Composer
          placeholder={
            blocked ?? (busy ? "The agent is replying…" : "Ask the agent")
          }
          value={text}
          onChange={setText}
          busy={busy}
          onSend={blocked ? undefined : send}
          // Stop replaces send while an order or check can still spend and
          // nothing is typed.
          onStop={
            stoppable && !text.trim() && w?.address
              ? () =>
                  navigation.navigate("AgentControl", {
                    wallet: w.address!,
                    command: "PAUSE",
                  })
              : undefined
          }
        />
      </View>

      <HistoryDrawer
        open={drawer}
        chats={history.data ?? []}
        loading={history.loading && !history.data}
        error={history.error}
        current={chatId}
        onClose={() => setDrawer(false)}
        onOpen={openChat}
        onNew={() => openChat(null)}
        onChanged={(deleted) => {
          history.reload();
          if (deleted && deleted === chatId) openChat(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function TurnView({
  turn,
  latest,
  tasks,
  onSend,
  onOpenTask,
}: {
  turn: Turn;
  // The newest reply, whose questions and products can still be answered.
  latest: boolean;
  tasks: Map<string, TaskView>;
  onSend: ((text: string) => void) | undefined;
  onOpenTask: (taskId: string) => void;
}) {
  const styles = useStyles();
  if (turn.kind === "user") return <UserBubble>{turn.text}</UserBubble>;
  const answer = latest ? onSend : undefined;
  const card = (c: ChatCard) => {
    switch (c.kind) {
      case "products":
        return (
          <ProductRow
            key={c.key}
            note={c.note}
            products={c.products}
            onChoose={
              answer &&
              ((p) => answer(`I'll take the ${p.name} (${p.productId}).`))
            }
          />
        );
      case "question":
        return (
          <QuestionChips
            key={c.key}
            question={c.question}
            options={c.options}
            onPick={answer}
          />
        );
      case "purchase":
        return (
          <OrderCard
            key={c.key}
            product={c.product}
            size={c.size}
            amount={c.amount}
            task={tasks.get(c.taskId)}
            onOpen={() => onOpenTask(c.taskId)}
          />
        );
      case "task":
        return (
          <CheckCard
            key={c.key}
            label={c.label}
            task={tasks.get(c.taskId)}
            onOpen={() => onOpenTask(c.taskId)}
          />
        );
      case "error":
        return <ErrorLine key={c.key} message={c.message} />;
    }
  };
  return (
    <AgentMessage>
      <WorkingSteps steps={turn.steps} writing={turn.writing} />
      {turn.text ? (
        <View
          style={styles.reply}
          accessibilityLiveRegion={turn.writing ? "polite" : "none"}
        >
          <Text style={styles.replyText}>{turn.text}</Text>
        </View>
      ) : turn.writing && !turn.steps.length ? (
        <Thinking />
      ) : null}
      {turn.cards.map(card)}
    </AgentMessage>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.ground },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  title: { ...type.heading, color: colors.ink, flex: 1 },
  walletPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  walletText: { ...type.small, fontWeight: "600", color: colors.primary },
  scroll: { flex: 1 },
  thread: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.xl,
  },
  welcome: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    gap: space.md,
    paddingBottom: space.xxxl,
  },
  welcomeTitle: { ...type.hero, color: colors.ink },
  welcomeText: { ...type.body, color: colors.ink2 },
  examples: { gap: space.sm, alignSelf: "stretch", marginTop: space.md },
  examplesTitle: { ...type.label, color: colors.ink3 },
  reply: {
    alignSelf: "flex-start",
    backgroundColor: colors.raised,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  replyText: { ...type.body, fontSize: 16, lineHeight: 22, color: colors.ink },
  composerWrap: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  off: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
}));
