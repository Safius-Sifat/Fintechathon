import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { OutlineButton } from "../components/Button";
import { Card, DetailRow, SectionTitle } from "../components/Card";
import { ChainChip } from "../components/ChainChip";
import { Icon } from "../components/Icon";
import { Screen } from "../components/Screen";
import { StateView } from "../components/StateView";
import { StatusTag } from "../components/StatusTag";
import { TaskStateChip } from "../components/TaskStateChip";
import {
  CONTACT_FACTS,
  CONTACT_FIELDS,
  CONTACTS_STATE,
  SAMPLE_CONTACTS,
} from "../config/contacts";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, space, type } from "../theme";

// Contacts preview (plan P3-W02, S8.1, S8.4). Contacts will be labels for
// full, checked addresses, stored encrypted on this phone. A label never
// verifies who controls an address. There is no storage yet, so the list
// reads unavailable rather than empty and Add contact is disabled.

type Props = NativeStackScreenProps<RootStackParamList, "Contacts">;

export function ContactsScreen({ navigation }: Props) {
  return (
    <Screen
      title="Contacts"
      subtitle="Your own names for addresses you send to."
      onBack={() => navigation.goBack()}
    >
      <Card>
        <StateView
          icon="account-box-outline"
          tone="slate"
          title={CONTACTS_STATE.title}
          tag={<StatusTag state={CONTACTS_STATE.state} />}
          body={CONTACTS_STATE.body}
        />
        <View style={styles.actions}>
          <OutlineButton
            label="Add contact"
            icon="account-plus-outline"
            disabled
            accessibilityHint="Unavailable. This build cannot store contacts."
          />
        </View>
      </Card>

      <SectionTitle>A name is not proof</SectionTitle>
      <Card>
        {CONTACT_FACTS.map((fact) => (
          <View key={fact} style={styles.point}>
            <Icon name="circle-small" size={20} color={colors.textMuted} />
            <Text style={[styles.body, styles.flex]}>{fact}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>What a contact holds</SectionTitle>
      <Card>
        {CONTACT_FIELDS.map((field) => (
          <DetailRow
            key={field.label}
            label={field.label}
            value={field.detail}
          />
        ))}
      </Card>

      {__DEV__ ? (
        <>
          <SectionTitle>Development sample</SectionTitle>
          <Text style={styles.caption}>
            Development builds only. Sample contacts to review the layout. They
            have no addresses and are not real recipients.
          </Text>
          {SAMPLE_CONTACTS.map((contact) => (
            <Card key={contact.label}>
              <StatusTag state="unavailable" label="Development sample" />
              <Text style={styles.cardTitle}>{contact.label}</Text>
              <TaskStateChip
                info={{ label: "Your label, not verified", group: "attention" }}
                icon="tag-outline"
              />
              <DetailRow label="Address" value={contact.addressNote} muted />
              <View style={styles.chip}>
                <ChainChip />
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.ink },
  body: { ...type.body, color: colors.text },
  caption: { ...type.small, color: colors.textMuted },
  flex: { flex: 1 },
  point: { flexDirection: "row", alignItems: "flex-start" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { alignSelf: "flex-start" },
});
