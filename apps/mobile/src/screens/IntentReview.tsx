import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { PrimaryButton, TextButton } from "../components/Button";
import { Card, DetailRow } from "../components/Card";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { inputSummary, reviewRows } from "../state/intentDraft";
import { useIntentDraft } from "../state/useIntentDraft";
import { currentDraftContext } from "../state/useSendDraft";
import { colors, space, type } from "../theme";

// Intent review preview (plan S9.3, P3-A02). The owner's goal next to every
// term a permission would contain, as the owner edited them. In the real
// flow the service drafts the exact terms from this draft and the native
// confirmation screen shows what is signed; neither exists, so approval is
// unavailable.

type Props = NativeStackScreenProps<RootStackParamList, "IntentReview">;

export function IntentReviewScreen({ navigation }: Props) {
  const state = useIntentDraft(currentDraftContext);
  const rows = reviewRows(state);
  const input = state.compiled ? inputSummary(state.compiled.input) : null;
  return (
    <Screen
      title="Review terms"
      subtitle="Your goal next to the terms you would sign."
      onBack={() => navigation.goBack()}
    >
      <Banner
        icon="information-outline"
        title="Preview: nothing can be approved"
        body="This build cannot create tasks or sign permissions. Approval happens on a protected screen that shows the exact terms you sign."
      />

      <Card>
        <Text style={styles.cardTitle}>Your goal</Text>
        <Text style={styles.goal}>{state.goal.trim() || "None"}</Text>
        <Text style={styles.caption}>Your words. They are not signed.</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Terms you would sign</Text>
        {state.compiled ? (
          <StatusTag state="unavailable" label={state.compiled.label} />
        ) : null}
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
        <DetailRow label="Agent wallet" value="Not created" muted />
        {rows.map((row) => (
          <View key={row.key} style={styles.term}>
            <DetailRow
              label={row.label}
              value={row.value}
              muted={!state.compiled}
            />
            {row.edited ? (
              <TaskStateChip
                info={{ label: "Changed by you", group: "active" }}
                icon="pencil-outline"
              />
            ) : null}
          </View>
        ))}
        <Text style={styles.caption}>
          Recipient addresses come from the trusted manifest, which this build
          does not load.
        </Text>
      </Card>

      {input ? (
        <Card>
          <Text style={styles.cardTitle}>Task details</Text>
          <DetailRow label="Page" value={input.page} />
          <DetailRow label="Checks" value={input.checks} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Checks before you sign</Text>
        <DetailRow
          label="Exact terms from the service"
          value="Not available"
          muted
        />
        <DetailRow label="Same as your edits" value="Not checked" muted />
        <DetailRow
          label="Within your wallet policy"
          value="Not checked"
          muted
        />
        <DetailRow
          label="Protected confirmation screen"
          value="Not built"
          muted
        />
        <Text style={styles.caption}>
          The protected screen shows the terms exactly as signed. If they differ
          from your edited draft, nothing is signed.
        </Text>
      </Card>

      <PrimaryButton
        label="Approve on this phone"
        icon="fingerprint"
        disabled
        accessibilityHint="Unavailable. Approval needs the Mandate service and the native confirmation screen."
      />
      <TextButton
        label="Edit draft"
        accessibilityHint="Returns to the draft"
        onPress={() => navigation.goBack()}
      />
      <Text style={styles.footnote}>
        Changing anything after review needs a new review and a new approval.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  goal: { ...type.body, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  term: { gap: space.xs },
  footnote: { ...type.small, color: colors.textMuted, textAlign: "center" },
});
