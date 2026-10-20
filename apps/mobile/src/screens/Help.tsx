import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import appJson from "../../app.json";
import { Card, DetailRow, SectionTitle } from "../components/Card";
import { Icon } from "../components/Icon";
import { IconTile } from "../components/IconTile";
import { NavRow } from "../components/NavRow";
import { Screen } from "../components/Screen";
import { HELP_TOPICS } from "../config/help";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Help (plan P3-W04 Network/Help, S8.1, S8.5). Plain-language notes on how
// the wallet works and what only the owner can do, especially keeping the
// recovery words. Static text and links to existing screens only.

type Props = NativeStackScreenProps<RootStackParamList, "Help">;

export function HelpScreen({ navigation }: Props) {
  return (
    <Screen
      title="Help"
      subtitle="How Mandate works, in plain words."
      onBack={() => navigation.goBack()}
    >
      {HELP_TOPICS.map((topic) => (
        <Card key={topic.id}>
          <View style={styles.head}>
            <IconTile icon={topic.icon} tone={topic.tone} size={40} />
            <Text style={[styles.cardTitle, styles.flex]}>{topic.title}</Text>
          </View>
          {topic.points.map((point) => (
            <View key={point} style={styles.point}>
              <Icon name="circle-small" size={20} color={colors.textMuted} />
              <Text style={[styles.body, styles.flex]}>{point}</Text>
            </View>
          ))}
        </Card>
      ))}

      <SectionTitle>Related</SectionTitle>
      <NavRow
        icon="key-chain-variant"
        tone="blue"
        label="Recovery and backup"
        value="Restore your owner key"
        accessibilityHint="Opens recovery and backup"
        onPress={() => navigation.navigate("Recovery")}
      />
      <NavRow
        icon="shield-key-outline"
        tone="amber"
        label="Owner control"
        value="Stop agents without the service"
        accessibilityHint="Opens owner control"
        onPress={() => navigation.navigate("Control")}
      />
      <NavRow
        icon="shield-lock-outline"
        tone="green"
        label="Security"
        value="Sessions and agent access"
        accessibilityHint="Opens security"
        onPress={() => navigation.navigate("Security")}
      />

      <SectionTitle>About this app</SectionTitle>
      <Card>
        <DetailRow label="App version" value={appJson.expo.version} />
        <DetailRow label="Build" value="Development preview" />
        <DetailRow
          label="Network"
          value={`${network.name} · Chain ${network.chainId}`}
        />
        <DetailRow label="Wallet plan" value="Person3 plan v7.1" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  point: { flexDirection: "row", alignItems: "flex-start" },
});
