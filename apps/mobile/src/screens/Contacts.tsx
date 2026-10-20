import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { PrimaryButton } from "../components/Button";
import {
  GhostButton,
  Note,
  Row,
  Rows,
  SectionHeading,
  Voice,
} from "../components/blocks";
import { Frame } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { updateDraft } from "../state/sendDraft";
import { useDraftContext } from "../state/useSendDraft";
import { fonts, makeStyles, radius, space, type, useColors } from "../theme";
import { checkAddress } from "../wallet/core";
import { shortAddress } from "../wallet/format";
import { readContacts, writeContacts, type Contact } from "../wallet/local";
import { useAsync } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "Contacts">;

// Address book stored on this phone only. Opened from Send, choosing a
// contact fills the recipient.
export function ContactsScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const pick = route.params?.pick === true;
  const context = useDraftContext();
  const list = useAsync(readContacts, []);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const checked = checkAddress(address);
  const contacts = list.data ?? [];
  const save = async (next: Contact[]) => {
    await writeContacts(next);
    list.reload();
  };
  return (
    <Frame
      title={pick ? "Choose a contact" : "Contacts"}
      onBack={() => navigation.goBack()}
    >
      {contacts.length === 0 ? (
        <Voice>No contacts yet.</Voice>
      ) : (
        <Rows>
          {contacts.map((c) => (
            <Row
              key={c.address}
              label={c.name}
              detail={shortAddress(c.address)}
              onPress={
                pick
                  ? () => {
                      updateDraft(context, { recipient: c.address });
                      navigation.goBack();
                    }
                  : undefined
              }
            />
          ))}
        </Rows>
      )}
      {!pick && contacts.length > 0 ? (
        <GhostButton
          label="Remove the last contact"
          onPress={() => save(contacts.slice(0, -1))}
        />
      ) : null}
      <SectionHeading>Add a contact</SectionHeading>
      <View style={styles.form}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={colors.ink3}
          maxLength={64}
          style={styles.input}
        />
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="0x… address"
          placeholderTextColor={colors.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.mono]}
        />
        {address && !checked.ok ? <Note>{checked.error}</Note> : null}
        <PrimaryButton
          label="Save contact"
          disabled={!checked.ok || name.trim() === ""}
          onPress={async () => {
            if (!checked.ok) return;
            await save([
              ...contacts.filter((c) => c.address !== checked.value),
              { name: name.trim(), address: checked.value },
            ]);
            setName("");
            setAddress("");
          }}
        />
      </View>
      <Note>Contacts are stored only on this phone.</Note>
    </Frame>
  );
}

const useStyles = makeStyles((colors) => ({
  form: { gap: space.sm },
  input: {
    ...type.body,
    minHeight: 52,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.raised,
    color: colors.ink,
  },
  mono: { fontFamily: fonts.mono },
}));
