import type { Finding } from "@mandate/schema";
import { StyleSheet, Text, View } from "react-native";
import {
  BASIS_LABELS,
  FINDING_NAMES,
  FINDING_STATE_LABELS,
  FINDING_TITLES,
  isAssertionOnly,
  type FindingState,
} from "../config/findings";
import { colors, radius, space, tones, type, type Tone } from "../theme";
import { Divider } from "./Card";
import { Icon, type IconName } from "./Icon";

const STATE_STYLE: Record<
  FindingState | "missing",
  { tone: Tone; icon: IconName }
> = {
  PASS: { tone: "green", icon: "check-circle-outline" },
  FAIL: { tone: "red", icon: "close-circle-outline" },
  PENDING: { tone: "blue", icon: "clock-outline" },
  UNVERIFIABLE: { tone: "amber", icon: "help-circle-outline" },
  missing: { tone: "slate", icon: "minus-circle-outline" },
};

// All six categories in fixed order. A category the report does not
// contain is shown as "Not reported", never skipped.
export function FindingList({ findings }: { findings: readonly Finding[] }) {
  return (
    <View style={styles.list}>
      {FINDING_NAMES.map((name, index) => {
        const finding = findings.find((f) => f.name === name);
        return (
          <View key={name} style={styles.item}>
            {index > 0 ? <Divider /> : null}
            <FindingRow name={name} finding={finding} />
          </View>
        );
      })}
    </View>
  );
}

function FindingRow({
  name,
  finding,
}: {
  name: Finding["name"];
  finding: Finding | undefined;
}) {
  const { title, detail } = FINDING_TITLES[name];
  const style = STATE_STYLE[finding?.state ?? "missing"];
  const t = tones[style.tone];
  const stateLabel = finding
    ? FINDING_STATE_LABELS[finding.state]
    : "Not reported";
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.chip, { backgroundColor: t.bg }]}>
          <Icon name={style.icon} size={14} color={t.fg} />
          <Text style={[styles.chipLabel, { color: t.fg }]}>{stateLabel}</Text>
        </View>
      </View>
      <Text style={styles.detail}>{detail}</Text>
      {finding ? (
        <>
          {finding.reason ? (
            <Text style={styles.reason}>{finding.reason}</Text>
          ) : null}
          <Text style={styles.meta}>
            Basis:{" "}
            {finding.basis.length > 0
              ? finding.basis.map((b) => BASIS_LABELS[b]).join(", ")
              : "None"}
          </Text>
          <Text style={styles.meta}>Rule: {finding.ruleId}</Text>
          <Text style={styles.meta}>
            Evidence:{" "}
            {finding.evidenceIds.length > 0
              ? finding.evidenceIds.join(", ")
              : "None"}
          </Text>
          {isAssertionOnly(finding) ? (
            <View style={styles.assertion}>
              <Icon name="account-voice" size={16} color={tones.amber.fg} />
              <Text style={styles.assertionText}>
                Service assertion only, not independent proof
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  item: { gap: space.md },
  row: { gap: space.xs },
  head: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  title: { ...type.bodyStrong, color: colors.ink },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  chipLabel: { ...type.label, flexShrink: 1 },
  detail: { ...type.small, color: colors.textMuted },
  reason: { ...type.body, color: colors.text },
  meta: { ...type.small, color: colors.textMuted },
  assertion: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    alignSelf: "flex-start",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    backgroundColor: tones.amber.bg,
  },
  assertionText: { ...type.label, color: tones.amber.fg, flexShrink: 1 },
});
