import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, Divider, SectionTitle } from "../components/Card";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import {
  ACTIONS_SCOPE_NOTE,
  ACTS_ON_LABEL,
  AGENT_SCOPE_INFO,
  AGENT_TOKEN_CANNOT,
  LOCAL_SECURITY,
  SECURITY_ACTIONS,
  SECURITY_INTRO,
  TOKEN_REVOKE_NOTE,
  type ActsOn,
} from "../config/securityAccess";
import {
  SAMPLE_AGENT_TOKENS,
  SAMPLE_SESSIONS,
} from "../config/securitySamples";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, tones, type } from "../theme";

// Security and agent access preview (plan P3-W01, P3-W03, S8.5; WQ09,
// WQ10). This phone, the Mandate service and the chain are kept apart:
// locking, logging out, signing out devices, revoking agent tokens and
// removing the wallet never end on-chain permissions. Nothing here is built,
// so there are no toggles and every action is disabled.

type Props = NativeStackScreenProps<RootStackParamList, "Security">;

const ACTS_ON_ICON = {
  phone: "cellphone",
  service: "cloud-outline",
  chain: "link-variant",
} as const satisfies Record<ActsOn, string>;

export function SecurityScreen({ navigation }: Props) {
  return (
    <Screen
      title="Security"
      subtitle={SECURITY_INTRO}
      onBack={() => navigation.goBack()}
    >
      <Banner
        icon="information-outline"
        title="Preview: no protection is on yet"
        body="This build has no wallet, app lock, service session or agent token. Nothing below can be changed."
      />

      <SectionTitle>On this phone</SectionTitle>
      <Card>
        {LOCAL_SECURITY.map((item, i) => (
          <View key={item.id} style={styles.group}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.head}>
              <IconTile icon={item.icon} tone={item.tone} size={40} />
              <View style={styles.flex}>
                <Text style={styles.bodyStrong}>{item.title}</Text>
                <StatusTag state={item.state} />
              </View>
            </View>
            <Text style={styles.caption}>{item.detail}</Text>
          </View>
        ))}
      </Card>
      <NavRow
        icon="key-chain-variant"
        tone="blue"
        label="Recovery and backup"
        value="Restore your owner key on a phone"
        accessibilityHint="Opens recovery and backup"
        onPress={() => navigation.navigate("Recovery")}
      />

      <SectionTitle>Mandate service sessions</SectionTitle>
      <Card>
        <DetailRow label="This phone" value="Not signed in" muted />
        <DetailRow label="Signed-in devices" value="Unavailable" muted />
        <Text style={styles.caption}>
          A session lets this phone use the Mandate service. It is not your
          owner key: ending it never deletes your wallet or changes what agents
          may do on chain.
        </Text>
        <View style={styles.actions}>
          <OutlineButton
            label="Log out"
            icon="logout"
            disabled
            accessibilityHint="Unavailable. This phone has no session with the Mandate service."
          />
          <OutlineButton
            label="Sign out other devices"
            icon="cellphone-remove"
            disabled
            accessibilityHint="Unavailable. Needs a session and a recent signed login on this phone."
          />
        </View>
        <Text style={styles.caption}>
          Device names are reported by each device. They are not proof of which
          phone it is.
        </Text>
      </Card>

      <SectionTitle>Agent access</SectionTitle>
      <Card>
        <Text style={styles.body}>
          Agent tokens let your agent tools call the Mandate service. They are
          not your owner key and carry no owner authority.
        </Text>
        <DetailRow label="Agent tokens" value="Unavailable" muted />
        <Divider />
        <Text style={styles.label}>What a token can be allowed to do</Text>
        {AGENT_SCOPE_INFO.map((scope) => (
          <View key={scope.id} style={styles.scope}>
            <Text style={styles.bodyStrong}>{scope.title}</Text>
            <Text style={styles.caption}>{scope.detail}</Text>
          </View>
        ))}
        <Divider />
        <Text style={styles.label}>No agent token can</Text>
        {AGENT_TOKEN_CANNOT.map((item) => (
          <View key={item} style={styles.point}>
            <Icon name="close" size={18} color={tones.red.fg} />
            <Text style={[styles.body, styles.flex]}>{item}</Text>
          </View>
        ))}
        <View style={styles.actions}>
          <OutlineButton
            label="Create token"
            icon="key-plus"
            disabled
            accessibilityHint="Unavailable. This build has no session with the Mandate service."
          />
          <OutlineButton
            label="Revoke token"
            icon="key-remove"
            disabled
            accessibilityHint="Unavailable. There are no agent tokens to show."
          />
        </View>
      </Card>
      <Banner
        icon="alert-outline"
        title="Revoking a token does not stop agents"
        body={TOKEN_REVOKE_NOTE}
      />

      <SectionTitle>What these actions do</SectionTitle>
      <Text style={styles.caption}>{ACTIONS_SCOPE_NOTE}</Text>
      <Card>
        {SECURITY_ACTIONS.map((action, i) => (
          <View key={action.id} style={styles.group}>
            {i > 0 ? <Divider /> : null}
            <Text style={styles.bodyStrong}>{action.title}</Text>
            <View style={styles.chips}>
              <TaskStateChip
                info={{ label: ACTS_ON_LABEL[action.actsOn], group: "ended" }}
                icon={ACTS_ON_ICON[action.actsOn]}
              />
              <TaskStateChip
                info={
                  action.endsOnChainPermissions
                    ? {
                        label: "Ends permissions once confirmed",
                        group: "ended",
                      }
                    : { label: "Agents keep working", group: "attention" }
                }
                icon={
                  action.endsOnChainPermissions
                    ? "stop-circle-outline"
                    : "robot-outline"
                }
              />
            </View>
            <Text style={styles.caption}>{action.effect}</Text>
          </View>
        ))}
      </Card>
      <NavRow
        icon="tune-variant"
        tone="amber"
        label="Agent controls"
        value="Freeze, pause or revoke"
        accessibilityHint="Opens agent controls"
        onPress={() => navigation.navigate("AgentControls")}
      />
      <NavRow
        icon="shield-key-outline"
        tone="amber"
        label="Owner control"
        value="Stop agents without the service"
        accessibilityHint="Opens owner control"
        onPress={() => navigation.navigate("Control")}
      />

      {__DEV__ ? (
        <>
          <SectionTitle>Development sample</SectionTitle>
          <Text style={styles.caption}>
            Development builds only. Sample sessions and agent tokens to review
            the layout. None of them exists.
          </Text>
          <Card>
            <StatusTag state="unavailable" label="Development sample" />
            <Text style={styles.label}>Signed-in devices</Text>
            {SAMPLE_SESSIONS.map((session) => (
              <View key={session.label} style={styles.sample}>
                <Text style={styles.bodyStrong}>{session.label}</Text>
                <View style={styles.chips}>
                  <TaskStateChip
                    info={{ label: "Name not verified", group: "attention" }}
                    icon="tag-outline"
                  />
                  {session.current ? (
                    <TaskStateChip
                      info={{ label: "This phone", group: "waiting" }}
                      icon="cellphone"
                    />
                  ) : null}
                </View>
                <DetailRow label="Last used" value={session.lastUsed} />
              </View>
            ))}
            <Divider />
            <Text style={styles.label}>Agent tokens</Text>
            {SAMPLE_AGENT_TOKENS.map((token) => (
              <View key={token.name} style={styles.sample}>
                <Text style={styles.bodyStrong}>{token.name}</Text>
                <DetailRow
                  label="Allowed"
                  value={token.scopes
                    .map(
                      (id) => AGENT_SCOPE_INFO.find((s) => s.id === id)!.title,
                    )
                    .join(", ")}
                />
                <DetailRow label="Limited to" value={token.limit} />
                <DetailRow label="Expires" value={token.expires} />
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, color: colors.text },
  bodyStrong: { ...type.bodyStrong, color: colors.ink },
  caption: { ...type.small, color: colors.textMuted },
  label: { ...type.label, color: colors.textMuted },
  flex: { flex: 1, gap: space.xs },
  group: { gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  scope: { gap: 2 },
  point: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  sample: { gap: space.xs },
});
