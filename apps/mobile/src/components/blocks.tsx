import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fonts, radius, space, touchTarget, type } from "../theme";
import { Icon, type IconName } from "./Icon";
import { Seal } from "./Seal";

// Small building blocks shared by the agent, stop and proof screens.

export function Rows({ children }: { children: ReactNode }) {
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
  const body = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {value ? (
        <Text style={[styles.rowValue, mono && styles.mono]}>{value}</Text>
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
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

export function Heading({ children }: { children: string }) {
  return (
    <Text style={styles.heading} accessibilityRole="header">
      {children}
    </Text>
  );
}

// The serif voice line used for goals, reasons and plain statements.
export function Voice({ children }: { children: ReactNode }) {
  return <Text style={styles.voice}>{children}</Text>;
}

export function BigAmount({ value, unit }: { value: string; unit?: string }) {
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
export interface StepItem {
  state: StepState;
  title: string;
  detail?: string;
}

export function Steps({ items }: { items: readonly StepItem[] }) {
  return (
    <View style={styles.steps}>
      {items.map((step, i) => (
        <View key={step.title} style={styles.step}>
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
const FINDING: Record<
  FindingState,
  { label: string; icon: IconName; color: string }
> = {
  PASS: { label: "Passed", icon: "check-circle", color: colors.ink },
  FAIL: { label: "Failed", icon: "close-circle", color: colors.accent },
  PENDING: { label: "Not yet", icon: "circle-outline", color: colors.ink3 },
  UNVERIFIABLE: {
    label: "Not independent",
    icon: "help-circle-outline",
    color: colors.ink,
  },
};

export function findingLabel(state: FindingState) {
  return FINDING[state].label;
}

interface FindingRowProps {
  name: string;
  state: FindingState;
  reason: string;
  onPress?: () => void;
}

// One of the six findings. State is spelled out in words; the glyph helps.
export function FindingRow({ name, state, reason, onPress }: FindingRowProps) {
  const f = FINDING[state];
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
const STEPS = 48;

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
  const [filled, setFilled] = useState(0);
  const [sealed, setSealed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const start = () => {
    if (disabled || sealed) return;
    stop();
    let n = 0;
    timer.current = setInterval(() => {
      n += 1;
      setFilled(n);
      if (n >= STEPS) {
        stop();
        setSealed(true);
        onSealed?.();
      }
    }, HOLD_MS / STEPS);
  };
  const cancel = () => {
    if (sealed) return;
    stop();
    setFilled(0);
  };
  return (
    <View style={styles.hold}>
      <Seal size={150} filled={filled} sealed={sealed} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Press and hold to confirm"
        disabled={disabled}
        onPressIn={start}
        onPressOut={cancel}
        style={[styles.holdButton, disabled && styles.holdDisabled]}
      >
        <Icon name="fingerprint" size={20} color={colors.onInk} />
        <Text style={styles.holdLabel}>{sealed ? "Sealed" : label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, color: colors.ink },
  rowDetail: { ...type.small, color: colors.ink2 },
  rowValue: {
    ...type.bodyStrong,
    color: colors.ink,
    maxWidth: "55%",
    textAlign: "right",
  },
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
    minHeight: 44,
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
  holdDisabled: { backgroundColor: colors.surfaceMuted },
  holdLabel: { ...type.bodyStrong, fontSize: 16, color: colors.onInk },
});
