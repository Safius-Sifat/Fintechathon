import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  palettes,
  fonts,
  radius,
  type Colors,
  space,
  stackedFontScale,
  touchTarget,
  type,
  makeStyles,
  useColors,
} from "../theme";
import {
  HOLD_STEPS,
  holdRelease,
  holdTick,
  idleHold,
  type Hold,
} from "../state/hold";
import { Icon, type IconName } from "./Icon";
import { Seal } from "./Seal";

// Small building blocks shared by the agent, stop and proof screens.

export function Rows({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.rows}>{children}</View>;
}

interface RowProps {
  label: string;
  value?: string;
  detail?: string;
  onPress?: () => void;
  mono?: boolean;
}

// Label left, value right, optional detail under the label. Tappable rows get
// a chevron.
export function Row({ label, value, detail, onPress, mono }: RowProps) {
  const colors = useColors();
  const styles = useStyles();
  // At large text sizes the value moves under the label instead of squeezing it.
  const stacked = useWindowDimensions().fontScale > stackedFontScale;
  const spoken = [label, detail, value].filter(Boolean).join(". ");
  const body = (
    <View
      style={[styles.row, stacked && styles.rowStacked]}
      accessible={onPress ? false : true}
      accessibilityLabel={onPress ? undefined : spoken}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {value ? (
        <Text
          style={[
            styles.rowValue,
            stacked && styles.rowValueStacked,
            mono && styles.mono,
          ]}
        >
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <Icon name="chevron-right" size={22} color={colors.ink3} />
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

export function Note({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.note}>{children}</Text>;
}

export function Heading({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <Text style={styles.heading} accessibilityRole="header">
      {children}
    </Text>
  );
}

// The serif voice line used for goals, reasons and plain statements.
export function Voice({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.voice}>{children}</Text>;
}

export function BigAmount({ value, unit }: { value: string; unit?: string }) {
  const styles = useStyles();
  return (
    <View
      style={styles.amountRow}
      accessible
      accessibilityLabel={`${value} ${unit ?? ""}`}
    >
      <Text style={styles.amount}>{value}</Text>
      {unit ? <Text style={styles.amountUnit}>{unit}</Text> : null}
    </View>
  );
}

export type StepState = "done" | "now" | "todo";
const STEP_WORDS: Record<StepState, string> = {
  done: "Done",
  now: "In progress",
  todo: "Not started",
};
export interface StepItem {
  state: StepState;
  title: string;
  detail?: string;
}

export function Steps({ items }: { items: readonly StepItem[] }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.steps}>
      {items.map((step, i) => (
        <View
          key={step.title}
          style={styles.step}
          accessible
          accessibilityLabel={`${STEP_WORDS[step.state]}. ${step.title}${step.detail ? `. ${step.detail}` : ""}`}
        >
          <View style={styles.stepMark}>
            {step.state === "done" ? (
              <Icon name="check-circle" size={26} color={colors.ink} />
            ) : step.state === "now" ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Icon name="circle-outline" size={26} color={colors.ink3} />
            )}
            {i < items.length - 1 ? (
              <View
                style={[
                  styles.stepLine,
                  step.state === "done" && styles.stepLineDone,
                ]}
              />
            ) : null}
          </View>
          <View style={styles.stepText}>
            <Text
              style={[styles.stepTitle, step.state === "todo" && styles.dim]}
            >
              {step.title}
            </Text>
            {step.detail ? (
              <Text style={styles.rowDetail}>{step.detail}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export type FindingState = "PASS" | "FAIL" | "PENDING" | "UNVERIFIABLE";
const findingStyle = (
  colors: Colors,
): Record<FindingState, { label: string; icon: IconName; color: string }> => ({
  PASS: { label: "Passed", icon: "check-circle", color: colors.ink },
  FAIL: { label: "Failed", icon: "close-circle", color: colors.accent },
  PENDING: { label: "Not yet", icon: "circle-outline", color: colors.ink3 },
  UNVERIFIABLE: {
    label: "Not independent",
    icon: "help-circle-outline",
    color: colors.ink,
  },
});

export function findingLabel(state: FindingState) {
  return findingStyle(palettes.light)[state].label;
}

interface FindingRowProps {
  name: string;
  state: FindingState;
  reason: string;
  onPress?: () => void;
}

// One of the six findings. State is spelled out in words; the glyph helps.
export function FindingRow({ name, state, reason, onPress }: FindingRowProps) {
  const styles = useStyles();
  const f = findingStyle(useColors())[state];
  const body = (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${name}. ${f.label}. ${reason}`}
    >
      <Icon name={f.icon} size={26} color={f.color} />
      <View style={styles.rowText}>
        <Text style={styles.stepTitle}>{name}</Text>
        <Text style={styles.rowDetail}>{reason}</Text>
      </View>
      <Text style={styles.findingState}>{f.label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}

export function Tag({ label, wax }: { label: string; wax?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.tag, wax && styles.tagWax]}>
      <Text style={[styles.tagText, wax && { color: colors.accent }]}>
        {label}
      </Text>
    </View>
  );
}

export function Chips<K extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly { key: K; label: string }[];
  selected: K;
  onSelect?: (key: K) => void;
}) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.key === selected;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect?.(o.key)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && { color: colors.onInk }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Outlined secondary action.
export function GhostButton({
  label,
  onPress,
}: {
  label: string;
  onPress?: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
    >
      <Text style={styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

const HOLD_MS = 600;

// Press and hold to sign. The seal fills while held; releasing early cancels
// with nothing signed. The caller decides what signing means; in a build that
// cannot sign, it must not pass onSealed.
export function HoldToSeal({
  label,
  onSealed,
  disabled,
}: {
  label: string;
  onSealed?: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  const [hold, setHold] = useState<Hold>(idleHold);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (hold.sealed) {
      stop();
      onSealed?.();
    }
    // onSealed fires once, when the hold completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold.sealed]);
  const start = () => {
    if (disabled || hold.sealed) return;
    stop();
    timer.current = setInterval(() => setHold(holdTick), HOLD_MS / HOLD_STEPS);
  };
  const release = () => {
    stop();
    setHold(holdRelease);
  };
  return (
    <View style={styles.hold}>
      <Seal size={150} filled={hold.filled} sealed={hold.sealed} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Press and hold to confirm"
        disabled={disabled}
        onPressIn={start}
        onPressOut={release}
        style={[styles.holdButton, disabled && styles.holdDisabled]}
      >
        <Icon name="fingerprint" size={20} color={colors.onInk} />
        <Text style={styles.holdLabel}>{hold.sealed ? "Sealed" : label}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  rows: { borderTopWidth: 1, borderTopColor: colors.rule },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    minHeight: touchTarget,
  },
  rowStacked: { flexDirection: "column", gap: space.xs },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, color: colors.ink },
  rowDetail: { ...type.small, color: colors.ink2 },
  rowValue: {
    ...type.bodyStrong,
    color: colors.ink,
    maxWidth: "55%",
    textAlign: "right",
  },
  rowValueStacked: { maxWidth: "100%", textAlign: "left" },
  mono: { fontFamily: fonts.mono },
  pressed: { opacity: 0.7 },
  note: { ...type.small, color: colors.ink2 },
  heading: { ...type.heading, color: colors.ink },
  voice: { ...type.voice, color: colors.ink },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  amount: { ...type.display, color: colors.ink },
  amountUnit: { ...type.body, color: colors.ink2 },
  steps: { gap: 0 },
  step: { flexDirection: "row", gap: space.lg, paddingBottom: space.xl },
  stepMark: { width: 26, alignItems: "center" },
  stepLine: {
    position: "absolute",
    top: 30,
    bottom: -space.xl + 4,
    width: 2,
    backgroundColor: colors.rule,
  },
  stepLineDone: { backgroundColor: colors.ink },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { ...type.heading, color: colors.ink },
  dim: { color: colors.ink3, fontWeight: "500" },
  findingState: { ...type.label, color: colors.ink, flexShrink: 0 },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.ink3,
  },
  tagWax: { borderColor: colors.accent },
  tagText: { ...type.small, color: colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: touchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { ...type.bodyStrong, color: colors.ink },
  ghost: {
    minHeight: 54,
    borderRadius: radius.pill,
    borderWidth: 1.25,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  ghostLabel: { ...type.bodyStrong, fontSize: 16, color: colors.ink },
  hold: { alignItems: "center", gap: space.lg },
  holdButton: {
    alignSelf: "stretch",
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: "row",
    gap: space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  holdDisabled: { backgroundColor: colors.tile },
  holdLabel: { ...type.bodyStrong, fontSize: 16, color: colors.onInk },
}));
