import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, Divider, SectionTitle } from "../components/Card";
import { ControlCard } from "../components/ControlCard";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import { SAMPLE_RECOVERY_STEPS } from "../config/controlSamples";
import { network } from "../config/network";
import {
  COMMAND_FOR,
  FEE_ROUTES,
  OWNER_CONTROL_IDS,
  RECONCILE_BEFORE_REPLACEMENT,
  SIGNED_COMMANDS,
  STEP_INFO,
  STEP_ORDER,
} from "../config/ownerControl";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, fonts, space, tones, type } from "../theme";

// Owner control preview (plan P3-05, S8.3; WQ07, WQ12). The owner can stop
// agents and recover agent wallet funds without the Mandate service or the
// agent signer, by signing a specific owner command on this phone and having
// it relayed. Nothing here reads the chain, signs, relays or exports: every
// action is disabled. A control counts only once it is confirmed on chain.

type Props = NativeStackScreenProps<RootStackParamList, "Control">;

const RELAY_HINT =
  "Unavailable. Needs the owner key on this phone, the native confirmation screen and a fee route.";

export function ControlScreen({ navigation }: Props) {
  return (
    <Screen
      title="Owner control"
      subtitle="Stop agents and recover agent wallet funds yourself, even when the Mandate service is down."
      onBack={() => navigation.goBack()}
    >
      <Banner
        icon="information-outline"
        title="Preview: nothing can be signed or sent"
        body="This build cannot read the agent wallet, sign an owner command or relay it. Every action below is unavailable."
      />

      <Card>
        <Text style={styles.cardTitle}>What owner control needs</Text>
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
        <DetailRow label="Agent wallet" value="Not created" muted />
        <DetailRow
          label="Trusted deployment manifest"
          value="Not loaded"
          muted
        />
        <DetailRow label="Trusted RPC" value="Not configured" muted />
        <DetailRow
          label="Paused, epoch and owner nonces"
          value="Unavailable"
          muted
        />
        <Divider />
        <DetailRow label="Mandate service" value="Not needed" />
        <DetailRow label="Agent signer (MPC)" value="Not needed" />
        <Text style={styles.caption}>
          The command is built on this phone from the wallet's current state,
          read straight from the chain, and signed with your owner key. No
          service or agent signer has to agree.
        </Text>
      </Card>

      <SectionTitle>Who pays the fee</SectionTitle>
      {FEE_ROUTES.map((route) => (
        <Card key={route.id}>
          <Text style={styles.cardTitle}>{route.title}</Text>
          <Text style={styles.body}>{route.payer}.</Text>
          <View style={styles.needs}>
            <Text style={styles.label}>Needs</Text>
            {route.needs.map((need) => (
              <View key={need} style={styles.point}>
                <Icon name="circle-small" size={20} color={colors.textMuted} />
                <Text style={[styles.body, styles.flex]}>{need}</Text>
              </View>
            ))}
          </View>
          <StatusTag state="notBuilt" label="Not available in this build" />
          <Text style={styles.caption}>{route.unavailableReason}</Text>
        </Card>
      ))}
      <Text style={styles.caption}>
        No route works without a network connection and someone paying gas. The
        fee payer is shown before you sign and never changes silently.
      </Text>

      <SectionTitle>From request to effect</SectionTitle>
      <Card>
        {STEP_ORDER.map((step) => (
          <View key={step} style={styles.step}>
            <TaskStateChip info={STEP_INFO[step]} />
            <Text style={styles.body}>{STEP_INFO[step].detail}</Text>
          </View>
        ))}
        <Text style={styles.caption}>
          Only a confirmed command counts, and only with its own effect. A
          payment sent before it may still settle.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Before preparing a replacement</Text>
        <Text style={styles.body}>
          An expired or unanswered command may still have been sent, or relayed
          by someone else. Check on chain first:
        </Text>
        {RECONCILE_BEFORE_REPLACEMENT.map((item) => (
          <View key={item} style={styles.point}>
            <Icon name="circle-small" size={20} color={colors.textMuted} />
            <Text style={[styles.body, styles.flex]}>{item}</Text>
          </View>
        ))}
        <Text style={styles.caption}>
          This build cannot read the chain, so it cannot check any of these.
        </Text>
      </Card>

      <SectionTitle>Owner operations</SectionTitle>
      {OWNER_CONTROL_IDS.map((id) => (
        <ControlCard
          key={id}
          id={id}
          unavailableHint={RELAY_HINT}
          signedAs={`${SIGNED_COMMANDS[COMMAND_FOR[id]].title} · up to ${SIGNED_COMMANDS[COMMAND_FOR[id]].maxLifetimeMinutes} minutes`}
        />
      ))}
      <Banner
        icon="format-list-numbered"
        title="Recovering several assets is a sequence"
        body="Each asset moves in its own transaction with its own fee and result. Anything that cannot be recovered, such as a vault that cannot redeem, stays visible as remaining."
      />
      <Text style={styles.caption}>
        A sweep is an owner transfer whose recipient is your owner address.
        Sending from the agent wallet to anyone else is also an owner transfer,
        with the recipient you review and sign.
      </Text>

      <SectionTitle>Signed command for another sender</SectionTitle>
      <Text style={styles.caption}>
        If you cannot pay the fee, a signed command can be given to a sender you
        choose. It authorizes the action, so hand it only to someone you trust.
        Never your recovery words or keys, and nothing is uploaded
        automatically.
      </Text>
      {(["admin", "ownerTransfer"] as const).map((kind) => {
        const command = SIGNED_COMMANDS[kind];
        return (
          <Card key={kind}>
            <Text style={styles.cardTitle}>{command.title}</Text>
            <DetailRow
              label="Valid for at most"
              value={`${command.maxLifetimeMinutes} minutes`}
            />
            <DetailRow label="Must match the wallet's" value={command.nonce} />
            <Text style={styles.label}>Signed fields</Text>
            <Text style={styles.mono}>{command.typedFields.join(", ")}</Text>
            <Text style={styles.label}>Export</Text>
            {command.exportFields ? (
              <Text style={styles.mono}>{command.exportFields.join(", ")}</Text>
            ) : (
              <StatusTag state="notBuilt" label="Format not defined yet" />
            )}
            <Text style={styles.caption}>{command.exportNote}</Text>
            <View style={styles.actions}>
              <OutlineButton
                label={`Export ${command.title.toLowerCase()}`}
                icon="export-variant"
                disabled
                accessibilityHint="Unavailable. Exporting needs a signed command, which this build cannot make."
              />
            </View>
          </Card>
        );
      })}

      {__DEV__ ? (
        <>
          <SectionTitle>Development sample</SectionTitle>
          <Text style={styles.caption}>
            Development builds only. A sample recovery sequence to review the
            layout. Nothing here happened, and no step is confirmed.
          </Text>
          <Card>
            <StatusTag state="unavailable" label="Development sample" />
            {SAMPLE_RECOVERY_STEPS.map((sample) => (
              <View key={sample.title} style={styles.sample}>
                <Text style={styles.bodyStrong}>{sample.title}</Text>
                <TaskStateChip
                  info={
                    sample.step === "remains"
                      ? { label: "Remains, not recovered", group: "attention" }
                      : STEP_INFO[sample.step]
                  }
                />
                <DetailRow label="Fee paid by" value={sample.feePayer} />
                <Text style={styles.caption}>{sample.note}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Restoring your wallet</SectionTitle>
      <NavRow
        icon="key-chain-variant"
        tone="blue"
        label="Recovery and backup"
        value="Restore your owner key on a phone"
        accessibilityHint="Opens what you need to restore this wallet"
        onPress={() => navigation.navigate("Recovery")}
      />
      <View style={styles.note}>
        <IconTile icon="call-split" tone="slate" size={36} />
        <Text style={styles.noteText}>
          Restoring the owner key gives you control again. Moving agent wallet
          funds is still a separate owner command on this screen.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  bodyStrong: { ...type.bodyStrong, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  label: { ...type.label, color: colors.textMuted },
  mono: { ...type.small, color: tones.slate.fg, fontFamily: fonts.mono },
  needs: { gap: 2 },
  point: { flexDirection: "row", alignItems: "flex-start" },
  flex: { flex: 1 },
  step: { gap: space.xs },
  sample: { gap: space.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  note: { flexDirection: "row", alignItems: "center", gap: space.md },
  noteText: { ...type.small, color: colors.textMuted, flex: 1 },
});
