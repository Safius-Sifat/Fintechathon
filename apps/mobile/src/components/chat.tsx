import { useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  radius,
  space,
  touchTarget,
  type,
  makeStyles,
  useColors,
} from "../theme";
import { Icon } from "./Icon";

// Building blocks of the agent thread: your messages on the right in the
// primary colour, the agent's text unboxed on the left under its mark.

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
}: {
  text?: string;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.agent}>
      <View style={styles.agentHead}>
        <View style={styles.mark}>
          <Icon name="robot-outline" size={16} color={colors.primary} />
        </View>
        <Text style={styles.agentName}>Agent</Text>
      </View>
      {text ? <Text style={styles.agentText}>{text}</Text> : null}
      {children}
    </View>
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
          <Icon name="stop" size={18} color={colors.onPrimary} />
          <Text style={styles.stopLabel}>Stop</Text>
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
  agent: { gap: space.sm },
  agentHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
  },
  agentName: { ...type.label, color: colors.ink2 },
  agentText: { ...type.body, fontSize: 16, lineHeight: 23, color: colors.ink },
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
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.lg,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  stopLabel: { ...type.bodyStrong, color: colors.onPrimary },
  pressed: { opacity: 0.8 },
}));
