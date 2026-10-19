import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow } from "../components/Card";
import { FindingList } from "../components/FindingList";
import { IconTile } from "../components/IconTile";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { StateView } from "../components/StateView";
import { StatusTag } from "../components/StatusTag";
import {
  BASIS_LABELS,
  SUMMARY_TEXT,
  summarizeFindings,
  type FindingBasis,
} from "../config/findings";
import { findSampleTask } from "../config/taskSamples";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Inspection layout. The service's findings are its own view of a task; an
// independent report comes from mandate-verify, run outside the app against
// the trusted manifest and the chain. The two are never shown as one. No
// real findings exist yet, so the service view is only filled from
// development samples.

type Props = NativeStackScreenProps<RootStackParamList, "Inspector">;

type Source = "service" | "independent";

const BASIS_DETAIL: Record<FindingBasis, string> = {
  chain: "Read from Base Sepolia.",
  signature: "Checked against a signature.",
  artifact: "Checked against stored output by its hash.",
  recorder_assertion: "The service's own statement. Not proof.",
};

export function InspectorScreen({ navigation, route }: Props) {
  const [source, setSource] = useState<Source>("service");
  const task = findSampleTask(route.params.sampleId);
  const back = () => navigation.goBack();
  if (!__DEV__ || !task) {
    return (
      <Screen title="Inspection" onBack={back}>
        <Banner
          icon="information-outline"
          title="Not available"
          body="Inspection findings need the Mandate service, which this build does not connect to."
        />
      </Screen>
    );
  }
  const summary = SUMMARY_TEXT[summarizeFindings(task.findings)];
  return (
    <Screen title="Inspection" subtitle={task.title} onBack={back}>
      <Segmented
        label="Findings from"
        options={[
          { key: "service", label: "Mandate service" },
          { key: "independent", label: "Independent report" },
        ]}
        selected={source}
        onSelect={setSource}
      />

      {source === "service" ? (
        <>
          <Banner
            icon="flask-outline"
            title="Development sample, not a real inspection"
            body="Findings, rules and evidence names are placeholders for reviewing this layout."
          />
          <Card>
            <View style={styles.summary}>
              <IconTile icon={summary.icon} tone={summary.tone} />
              <View style={styles.summaryText}>
                <Text style={styles.cardTitle}>{summary.title}</Text>
                <Text style={styles.caption}>{summary.body}</Text>
              </View>
            </View>
            <StatusTag state="unavailable" label="Service view, sample" />
            <Text style={styles.caption}>
              These are the Mandate service's own findings. They are not an
              independent check.
            </Text>
          </Card>
          <Card>
            <FindingList findings={task.findings} />
          </Card>
        </>
      ) : (
        <Card>
          <StateView
            icon="file-search-outline"
            tone="violet"
            title="No independent report"
            tag={<StatusTag state="notBuilt" label="Not loaded" />}
            body="An independent report comes from the mandate-verify tool, run outside this app with the trusted deployment manifest and its own chain connection. This app does not create one."
          />
        </Card>
      )}

      <Card>
        <Text style={styles.cardTitle}>What the basis means</Text>
        {(Object.keys(BASIS_DETAIL) as FindingBasis[]).map((basis) => (
          <DetailRow
            key={basis}
            label={BASIS_LABELS[basis]}
            value={BASIS_DETAIL[basis]}
          />
        ))}
      </Card>

      <View style={styles.actions}>
        <OutlineButton
          label="Export evidence"
          icon="download-outline"
          disabled
          accessibilityHint="Unavailable. Export needs a signed-in session with the Mandate service."
        />
      </View>
      <Text style={styles.footnote}>
        Export is a download you start. Links and logs are never shared
        automatically.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  footnote: { ...type.small, color: colors.textMuted, textAlign: "center" },
  summary: { flexDirection: "row", alignItems: "center", gap: space.md },
  summaryText: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
