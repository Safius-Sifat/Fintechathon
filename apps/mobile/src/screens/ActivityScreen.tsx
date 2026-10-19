import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, SectionTitle } from "../components/Card";
import { CapabilityRow } from "../components/CapabilityRow";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { StateView } from "../components/StateView";
import { StatusTag } from "../components/StatusTag";
import { TxStatusChip } from "../components/TxStatusChip";
import { historySources, type ActivitySource } from "../config/activity";
import { SAMPLE_ACTIVITY, type SampleActivity } from "../config/devSamples";
import { GROUP_INFO, type StatusGroup } from "../config/txStatus";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Personal and agent-wallet histories are separate lists and are never
// merged. Neither source exists yet, so both show "History unavailable",
// which is not the same as an empty history.

const GROUPS: readonly StatusGroup[] = [
  "pending",
  "confirmed",
  "failed",
  "replaced",
  "unknown",
];

export function ActivityScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [source, setSource] = useState<ActivitySource>("personal");
  const history = historySources[source];
  const samples = SAMPLE_ACTIVITY.filter((s) => s.source === source);

  return (
    <Screen title="Activity" subtitle="Personal transfers and agent spending">
      <Segmented
        label="History"
        options={[
          { key: "personal", label: "Personal account" },
          { key: "agent", label: "Agent wallet" },
        ]}
        selected={source}
        onSelect={setSource}
      />

      <Card>
        <StateView
          icon="cloud-off-outline"
          tone="amber"
          title="History unavailable"
          tag={<StatusTag state="unavailable" />}
          body={history.body}
        />
        <CapabilityRow capability={history.source} />
      </Card>

      <SectionTitle>What the states mean</SectionTitle>
      <Card>
        {GROUPS.map((group) => (
          <View key={group} style={styles.guideRow}>
            <TxStatusChip group={group} />
            <Text style={styles.guideText}>{GROUP_INFO[group].detail}</Text>
          </View>
        ))}
      </Card>

      {__DEV__ ? (
        <>
          <SectionTitle>Development samples</SectionTitle>
          <Text style={styles.devNote}>
            Development builds only. Placeholder records to review the detail
            layout. They are not transactions and never appear in a release
            build.
          </Text>
          <Card>
            {samples.map((sample) => (
              <SampleRow
                key={sample.id}
                sample={sample}
                onPress={() =>
                  navigation.navigate("TransactionDetail", {
                    sampleId: sample.id,
                  })
                }
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function SampleRow({
  sample,
  onPress,
}: {
  sample: SampleActivity;
  onPress: () => void;
}) {
  const sent = sample.direction === "sent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the sample details"
      onPress={onPress}
      style={({ pressed }) => [styles.sampleRow, pressed && styles.pressed]}
    >
      <IconTile
        icon={sent ? "arrow-top-right" : "arrow-bottom-left"}
        tone={sample.source === "agent" ? "amber" : "blue"}
        size={40}
      />
      <View style={styles.sampleText}>
        <Text style={styles.sampleTitle}>{sample.title}</Text>
        <Text style={styles.sampleAmount}>
          {sent ? "−" : "+"}
          {sample.amount} {sample.asset}
        </Text>
        <View style={styles.tags}>
          <TxStatusChip state={sample.state} />
          <StatusTag state="unavailable" label="Development sample" />
        </View>
      </View>
      <Icon name="chevron-right" size={24} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  guideRow: { gap: space.xs },
  guideText: { ...type.small, color: colors.textMuted },
  devNote: { ...type.small, color: colors.textMuted },
  sampleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xs,
  },
  pressed: { opacity: 0.7 },
  sampleText: { flex: 1, gap: space.xs },
  sampleTitle: { ...type.bodyStrong, color: colors.ink },
  sampleAmount: { ...type.body, color: colors.text },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
