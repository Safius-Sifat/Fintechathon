import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AmountField } from "../components/AmountField";
import { Banner } from "../components/Banner";
import { OutlineButton, PrimaryButton, TextButton } from "../components/Button";
import { Card, DetailRow, Divider, SectionTitle } from "../components/Card";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { ToggleRow } from "../components/ToggleRow";
import { CEILINGS } from "../config/agentLimits";
import {
  SAMPLE_AUTHORIZATIONS,
  SAMPLE_CURRENT_POLICY,
  SAMPLE_POLICY_VERSION,
} from "../config/policySamples";
import {
  AGENT_ASSET_OPTIONS,
  ASSET_LABELS,
  PROVIDER_LABELS,
} from "../config/taskLabels";
import { formatAgentAmount } from "../domain/amounts";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  AGENT_ASSETS,
  allowlistState,
  allowlistTurnsOff,
  capSummary,
  clearPolicyForm,
  formFromSnapshot,
  loadPolicyForm,
  policyChanges,
  setRecipientChoice,
  stoppedAuthorizations,
  updatePolicyCap,
  updatePolicyReview,
  validatePolicyForm,
  type PolicySnapshot,
  type RecipientChoice,
} from "../state/policyDraft";
import {
  PROVIDERS,
  type AgentAsset,
  type ProviderId,
} from "../state/taskDraft";
import { usePolicyEditor } from "../state/usePolicyEditor";
import { currentDraftContext } from "../state/useSendDraft";
import { colors, space, tones, type } from "../theme";

// Wallet policy editor preview (plan S9.4, P3-A02). The form works locally
// so the layout, limits and warnings can be reviewed. The current policy is
// read from the agent wallet contract and a change is signed on the native
// confirmation screen, which recomputes the list hashes; neither exists in
// this build, so nothing is read, signed or sent. Leaving discards the draft.

type Props = NativeStackScreenProps<RootStackParamList, "WalletPolicy">;

const fmt = formatAgentAmount;

const RECIPIENT_OPTIONS = [
  { key: "allowed", label: "Allowed" },
  { key: "none", label: "Not listed" },
  { key: "blocked", label: "Blocked" },
] as const;

export function WalletPolicyScreen({ navigation }: Props) {
  const context = currentDraftContext;
  const { form, baseline } = usePolicyEditor(context);
  const [asset, setAsset] = useState<AgentAsset>("DemoUSD");
  const check = validatePolicyForm(form);
  const cap = form.caps[asset];
  const label = ASSET_LABELS[asset];
  const allowedCount = PROVIDERS.filter(
    (p) => form.recipients[p] === "allowed",
  ).length;
  const blockedCount = PROVIDERS.filter(
    (p) => form.recipients[p] === "blocked",
  ).length;
  const listOn = allowlistState(form) === "on";

  useEffect(
    () =>
      navigation.addListener("beforeRemove", () => clearPolicyForm(context)),
    [navigation, context],
  );

  return (
    <Screen
      title="Wallet policy"
      subtitle="Rules for all agent spending. The strictest rule always wins."
      onBack={() => navigation.goBack()}
    >
      <Banner
        icon="information-outline"
        title="Preview: nothing can be signed"
        body="This build cannot read or change your wallet policy. A change counts only after you sign it on a protected screen and it is confirmed on chain."
      />

      <CurrentPolicy
        baseline={baseline}
        onLoadSample={() =>
          loadPolicyForm(
            context,
            formFromSnapshot(SAMPLE_CURRENT_POLICY),
            SAMPLE_CURRENT_POLICY,
          )
        }
      />

      <SectionTitle>Limits per asset</SectionTitle>
      <Card>
        <Segmented
          label="Asset"
          options={AGENT_ASSET_OPTIONS.map((o) => ({
            key: o.key,
            label: o.label,
          }))}
          selected={asset}
          onSelect={setAsset}
        />
        <ToggleRow
          label={`Agents may spend ${label}`}
          detail={
            asset === "USDC"
              ? "Agents cannot use test USDC until it has its own limits."
              : "Without limits for an asset, agents cannot spend it."
          }
          checked={cap.enabled}
          onToggle={() =>
            updatePolicyCap(context, asset, { enabled: !cap.enabled })
          }
        />
        {cap.enabled ? (
          <>
            <AmountField
              label="Per payment"
              value={cap.perTx}
              onChangeText={(t) =>
                updatePolicyCap(context, asset, { perTx: t })
              }
              placeholder={`0.00 ${label}`}
              hint={`Up to ${fmt(CEILINGS.perPayment)} ${label}`}
              error={check.fieldErrors[`${asset}.perTx`]}
            />
            <AmountField
              label="Per day, all agents together"
              value={cap.daily}
              onChangeText={(t) =>
                updatePolicyCap(context, asset, { daily: t })
              }
              placeholder={`0.00 ${label}`}
              hint={`Up to ${fmt(CEILINGS.walletDay)} ${label}`}
              error={check.fieldErrors[`${asset}.daily`]}
            />
            <AmountField
              label="Per week, all agents together"
              value={cap.weekly}
              onChangeText={(t) =>
                updatePolicyCap(context, asset, { weekly: t })
              }
              placeholder={`0.00 ${label}`}
              hint={`Up to ${fmt(CEILINGS.walletWeek)} ${label}`}
              error={check.fieldErrors[`${asset}.weekly`]}
            />
          </>
        ) : (
          <DetailRow
            label={`${label} limits`}
            value={capSummary(undefined)}
            muted
          />
        )}
        <Text style={styles.caption}>
          Days run midnight to midnight UTC; weeks are fixed seven-day blocks.
          Every task's own limits still apply, and the lower limit wins.
        </Text>
      </Card>

      <SectionTitle>Recipients</SectionTitle>
      <Card>
        <TaskStateChip
          info={
            listOn
              ? { label: "Allowlist on", group: "active" }
              : { label: "Allowlist off", group: "ended" }
          }
          icon={listOn ? "filter-check-outline" : "filter-off-outline"}
        />
        <Text style={styles.body}>
          {listOn
            ? "Agents can pay only allowed recipients."
            : "With no allowed recipients, agents can pay any recipient a task's own approved terms name, unless it is blocked."}
        </Text>
        {PROVIDERS.map((p) => (
          <View key={p} style={styles.recipient}>
            <Segmented
              label={PROVIDER_LABELS[p]}
              compact
              options={RECIPIENT_OPTIONS}
              selected={form.recipients[p]}
              onSelect={(choice: RecipientChoice) =>
                setRecipientChoice(context, p, choice)
              }
            />
            <Text style={styles.caption}>
              Address from the trusted manifest (not loaded)
            </Text>
          </View>
        ))}
        <Divider />
        <DetailRow label="Contacts" value="Not available yet" muted />
        <DetailRow
          label="Allowed"
          value={`${allowedCount} of ${CEILINGS.policyList}`}
        />
        <DetailRow
          label="Blocked"
          value={`${blockedCount} of ${CEILINGS.policyList}`}
        />
        <Text style={styles.caption}>
          A block always wins, and it stops a recipient at once, even for active
          tasks.
        </Text>
      </Card>

      {allowlistTurnsOff(baseline, form) ? (
        <Warning
          title="This turns the allowlist off"
          body="Removing the last allowed recipient lets agents pay more recipients, not fewer. To stop paying a recipient, block it or revoke the task."
        />
      ) : null}

      <SectionTitle>Contract calls</SectionTitle>
      <Card>
        <DetailRow
          label="Allowed call templates"
          value={`0 of ${CEILINGS.policyTemplates}`}
        />
        <Text style={styles.body}>
          None available. Templates come from the trusted deployment manifest,
          which this build does not load.
        </Text>
        <Text style={styles.caption}>
          Token approvals, transfers and pulls can never be templates. Removing
          a template stops it at once.
        </Text>
      </Card>

      <SectionTitle>Review threshold</SectionTitle>
      <Card>
        <Segmented
          label="Payments that wait for your approval"
          options={[
            { key: "above", label: "Above an amount" },
            { key: "never", label: "None" },
          ]}
          selected={form.review.mode}
          onSelect={(mode) => updatePolicyReview(context, { mode })}
        />
        {form.review.mode === "above" ? (
          <AmountField
            label="Ask me for payments above"
            value={form.review.amount}
            onChangeText={(t) => updatePolicyReview(context, { amount: t })}
            placeholder="0.00"
            hint="Applies to payments in either asset"
            error={check.fieldErrors.review}
          />
        ) : null}
        <Text style={styles.caption}>
          A task can set a lower threshold, and the lower one applies. A payment
          that waits is held for up to 15 minutes.
        </Text>
      </Card>

      <SectionTitle>Before you sign</SectionTitle>
      <Changes
        baseline={baseline}
        snapshot={check.snapshot}
        missing={check.missing}
      />
      <Unsettled baseline={baseline} snapshot={check.snapshot} />

      <Card>
        <DetailRow label="Form checks" value="On this phone only" />
        <DetailRow label="Native signing check" value="Not built" muted />
        <DetailRow label="Signature valid for" value="30 minutes" />
        <Text style={styles.caption}>
          The form checks limits here. The protected signing screen must check
          the lists and limits again; it is not built, so no policy can be
          signed. Policy changes work while agents are frozen or paused.
        </Text>
      </Card>

      <PrimaryButton
        label="Sign policy on this phone"
        icon="fingerprint"
        disabled
        accessibilityHint="Unavailable. Signing a policy needs the owner key and the native confirmation screen."
      />
      <TextButton
        label="Discard changes"
        accessibilityHint="Clears this form"
        onPress={() => clearPolicyForm(context)}
      />
    </Screen>
  );
}

function CurrentPolicy({
  baseline,
  onLoadSample,
}: {
  baseline: PolicySnapshot | null;
  onLoadSample: () => void;
}) {
  if (!baseline)
    return (
      <Card>
        <Text style={styles.cardTitle}>Policy on chain now</Text>
        <DetailRow label="Version" value="Unavailable" muted />
        <DetailRow label="Asset limits" value="Unavailable" muted />
        <DetailRow label="Allowlist and blocklist" value="Unavailable" muted />
        <DetailRow label="Call templates" value="Unavailable" muted />
        <DetailRow label="Review threshold" value="Unavailable" muted />
        <Text style={styles.caption}>
          Read from the agent wallet contract. This build cannot read it, so the
          form below starts empty.
        </Text>
        {__DEV__ ? (
          <View style={styles.actions}>
            <OutlineButton
              label="Start from development sample"
              icon="flask-outline"
              accessibilityHint="Fills the form from a labelled sample policy. Development builds only."
              onPress={onLoadSample}
            />
          </View>
        ) : null}
      </Card>
    );
  const list = (ids: readonly ProviderId[]) =>
    ids.map((p) => PROVIDER_LABELS[p]).join(", ") || "None";
  return (
    <Card>
      <Text style={styles.cardTitle}>Development baseline</Text>
      <StatusTag state="unavailable" label="Development sample" />
      <DetailRow label="Your policy on chain" value="Unavailable" muted />
      <Divider />
      <DetailRow label="Sample version" value={String(SAMPLE_POLICY_VERSION)} />
      {AGENT_ASSETS.map((a) => (
        <DetailRow
          key={a}
          label={ASSET_LABELS[a]}
          value={capSummary(baseline.caps[a])}
        />
      ))}
      <DetailRow label="Allowed" value={list(baseline.allowlist)} />
      <DetailRow label="Blocked" value={list(baseline.blocklist)} />
      <DetailRow
        label="Review threshold"
        value={
          baseline.reviewThreshold === null
            ? "None"
            : `Above ${fmt(baseline.reviewThreshold)}`
        }
      />
      <Text style={styles.caption}>
        Limits are per payment · per day · per week. A labelled sample to
        compare drafts against. It is not your policy.
      </Text>
    </Card>
  );
}

function Changes({
  baseline,
  snapshot,
  missing,
}: {
  baseline: PolicySnapshot | null;
  snapshot: PolicySnapshot | null;
  missing: readonly string[];
}) {
  const changes = baseline && snapshot ? policyChanges(baseline, snapshot) : [];
  return (
    <Card>
      <Text style={styles.cardTitle}>What this draft would change</Text>
      {!snapshot ? (
        <>
          <Text style={styles.body}>Finish the form to see the changes.</Text>
          {missing.length > 0 ? (
            <Text style={styles.caption}>
              Still needed: {missing.join(", ")}
            </Text>
          ) : null}
        </>
      ) : !baseline ? (
        <Text style={styles.body}>
          Your current policy cannot be read, so the changes cannot be listed.
        </Text>
      ) : changes.length === 0 ? (
        <Text style={styles.body}>No changes yet.</Text>
      ) : (
        changes.map((change) => (
          <View key={change.text} style={styles.change}>
            <Icon
              name={
                change.tightens
                  ? "arrow-down-circle-outline"
                  : "arrow-up-circle-outline"
              }
              size={20}
              color={change.tightens ? tones.blue.fg : tones.amber.fg}
            />
            <View style={styles.changeText}>
              <Text style={styles.body}>{change.text}</Text>
              <Text style={styles.caption}>
                {change.tightens ? "Tightens" : "Loosens"}
              </Text>
            </View>
          </View>
        ))
      )}
      <Text style={styles.caption}>
        Worked out on this phone from the form
        {baseline ? ", against the development baseline" : ""}. Nothing changes
        on chain until you sign and the change is confirmed. Then tightening
        applies at once to active tasks; loosening never gives a task more than
        its own approved terms.
      </Text>
    </Card>
  );
}

function Unsettled({
  baseline,
  snapshot,
}: {
  baseline: PolicySnapshot | null;
  snapshot: PolicySnapshot | null;
}) {
  if (!baseline || !__DEV__)
    return (
      <Card>
        <Text style={styles.cardTitle}>
          Unsettled x402 payments it would stop
        </Text>
        <StatusTag state="unavailable" />
        <Text style={styles.body}>
          This is not an empty list. Unsettled payments are read from the agent
          wallet contract, which this build cannot read.
        </Text>
      </Card>
    );
  const stopped = snapshot
    ? stoppedAuthorizations(snapshot, SAMPLE_AUTHORIZATIONS)
    : [];
  return (
    <Card>
      <Text style={styles.cardTitle}>
        Unsettled x402 payments it would stop
      </Text>
      <StatusTag state="unavailable" label="Development sample" />
      {SAMPLE_AUTHORIZATIONS.map((auth) => {
        const hit = stopped.find((s) => s.id === auth.id);
        return (
          <View key={auth.id} style={styles.auth}>
            <Text style={styles.bodyStrong}>
              {`${fmt(auth.amount)} ${ASSET_LABELS[auth.asset]} to ${PROVIDER_LABELS[auth.recipient]}`}
            </Text>
            <Text style={styles.caption}>
              {auth.ownerApproved
                ? "Approved by you"
                : "Below the threshold when made"}
            </Text>
            {!snapshot ? (
              <Text style={styles.caption}>Finish the form to check it.</Text>
            ) : hit ? (
              <>
                <TaskStateChip
                  info={{ label: "Would stop", group: "attention" }}
                />
                {hit.reasons.map((r) => (
                  <Text key={r} style={styles.body}>
                    {r}
                  </Text>
                ))}
              </>
            ) : (
              <TaskStateChip info={{ label: "Not affected", group: "ended" }} />
            )}
          </View>
        );
      })}
      <Text style={styles.caption}>
        A lower daily or weekly limit does not stop these: their amount was
        already counted. A payment that settles before the change is confirmed
        stays paid.
      </Text>
    </Card>
  );
}

function Warning({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <View style={styles.warningHead}>
        <IconTile icon="alert-outline" tone="amber" size={40} />
        <Text style={[styles.cardTitle, styles.flex]}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  bodyStrong: { ...type.bodyStrong, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  recipient: { gap: space.xs },
  change: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  changeText: { flex: 1, gap: 2 },
  auth: { gap: space.xs },
  warningHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
});
