import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { StepItem } from "./blocks";
import {
  radius,
  space,
  touchTarget,
  type,
  makeStyles,
  useColors,
} from "../theme";
import { Icon } from "./Icon";
import { MandateMark } from "./MandateMark";

// Building blocks of the agent thread: your messages on the right in the
// primary colour, the agent's on the left in a raised bubble beside its mark.
// Back-to-back agent messages share one mark.

export function UserBubble({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <View style={styles.userRow}>
      <Text style={styles.userBubble} accessibilityLabel={`You: ${children}`}>
        {children}
      </Text>
    </View>
  );
}

export function AgentMessage({
  text,
  children,
  continued,
}: {
  text?: string;
  children?: ReactNode;
  // Follows another agent message, so the mark is not repeated.
  continued?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.agent, continued && styles.agentContinued]}>
      <View style={styles.markColumn}>
        {continued ? null : (
          <View accessible accessibilityLabel="Agent">
            <MandateMark size={28} />
          </View>
        )}
      </View>
      <View style={styles.agentBody}>
        {text ? (
          <View
            style={[styles.agentBubble, continued && styles.bubbleContinued]}
          >
            <Text style={styles.agentText}>{text}</Text>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

// The agent's progress: small marks and quiet lines, so its sentence leads.
export function ThreadSteps({ items }: { items: readonly StepItem[] }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.steps}>
      {items.map((s) => (
        <View
          key={s.title}
          style={styles.stepRow}
          accessible
          accessibilityLabel={`${s.state === "done" ? "Done" : s.state === "failed" ? "Failed" : s.state === "now" ? "In progress" : "Not started"}. ${s.title}`}
        >
          <View style={styles.stepMark}>
            {s.state === "done" ? (
              <Icon name="check-circle" size={16} color={colors.good} />
            ) : s.state === "failed" ? (
              <Icon name="close-circle" size={16} color={colors.bad} />
            ) : s.state === "now" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="circle-outline" size={16} color={colors.ink4} />
            )}
          </View>
          <View style={styles.stepText}>
            <Text
              style={[styles.stepTitle, s.state === "now" && styles.stepNow]}
            >
              {s.title}
            </Text>
            {s.detail ? (
              <Text style={styles.stepDetail}>{s.detail}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// What the agent is doing this moment, pinned above the message box.
export function NowLine({ text }: { text: string }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.now} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.nowText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

export function TextLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

// A boxed card inside an agent message: something to read and decide on.
export function ThreadCard({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.card}>{children}</View>;
}

export function CardLine({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View
      style={styles.line}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

// Tappable starter prompts above the composer.
export function Suggestions({
  items,
  onPick,
}: {
  items: readonly string[];
  onPick: (text: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.suggestions}>
      {items.map((s) => (
        <Pressable
          key={s}
          accessibilityRole="button"
          onPress={() => onPick(s)}
          style={({ pressed }) => [
            styles.suggestion,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.suggestionText}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Message box with send. While the agent can spend, the send button becomes
// Stop, as in the agent apps this follows.
export function Composer({
  placeholder,
  onSend,
  onPlus,
  onStop,
  value,
  onChange,
  busy,
}: {
  placeholder: string;
  onSend?: (text: string) => void;
  onPlus?: () => void;
  onStop?: () => void;
  value?: string;
  onChange?: (v: string) => void;
  busy?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  const [own, setOwn] = useState("");
  const text = value ?? own;
  const setText = onChange ?? setOwn;
  const canSend = !!onSend && text.trim().length > 0 && !busy;
  return (
    <View style={styles.composer}>
      {onPlus ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fill in the details yourself"
          onPress={onPlus}
          style={({ pressed }) => [styles.plus, pressed && styles.pressed]}
        >
          <Icon name="plus" size={22} color={colors.ink2} />
        </Pressable>
      ) : null}
      <TextInput
        value={text}
        onChangeText={setText}
        editable={!!onSend && !busy}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        multiline
        style={styles.input}
      />
      {onStop ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stop the agent"
          onPress={onStop}
          style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
        >
          <Icon name="stop" size={20} color={colors.onPrimary} />
        </Pressable>
      ) : onSend ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={() => {
            onSend(text.trim());
            setText("");
          }}
          style={({ pressed }) => [
            styles.send,
            !canSend && styles.sendOff,
            pressed && styles.pressed,
          ]}
        >
          <Icon
            name="arrow-up"
            size={22}
            color={canSend ? colors.onPrimary : colors.ink4}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  userRow: { alignItems: "flex-end" },
  userBubble: {
    ...type.body,
    maxWidth: "85%",
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
    overflow: "hidden",
  },
  agent: { flexDirection: "row", gap: space.sm, paddingRight: space.xl },
  agentContinued: { marginTop: -space.md },
  markColumn: { width: 28 },
  agentBody: { flex: 1, gap: space.sm },
  agentBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.raised,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  bubbleContinued: { borderTopLeftRadius: radius.lg },
  steps: { gap: space.sm, paddingLeft: space.xs, alignSelf: "stretch" },
  stepRow: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  stepMark: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { flex: 1 },
  stepTitle: { ...type.small, color: colors.ink2 },
  stepNow: { color: colors.ink, fontWeight: "600" },
  stepDetail: { ...type.small, color: colors.ink3 },
  now: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    marginBottom: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
  },
  nowText: { ...type.small, color: colors.ink, flex: 1, fontWeight: "600" },
  link: { minHeight: 32, justifyContent: "center" },
  linkText: { ...type.bodyStrong, color: colors.primary },
  agentText: { ...type.body, fontSize: 16, lineHeight: 22, color: colors.ink },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.raised,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.md,
  },
  lineLabel: { ...type.body, color: colors.ink2, flexShrink: 1 },
  lineValue: {
    ...type.bodyStrong,
    color: colors.ink,
    textAlign: "right",
    flexShrink: 1,
  },
  suggestions: { gap: space.sm },
  suggestion: {
    alignSelf: "flex-start",
    minHeight: touchTarget - 4,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  suggestionText: { ...type.bodyStrong, color: colors.primary },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.raised,
  },
  plus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tile,
  },
  input: {
    ...type.body,
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: space.sm,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.ink,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  sendOff: { backgroundColor: colors.tile },
  stop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.8 },
}));
