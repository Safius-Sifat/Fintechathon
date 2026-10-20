import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import {
  GhostButton,
  Note,
  Row,
  Rows,
  SectionHeading,
} from "../components/blocks";
import { Frame } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { clearAllDrafts } from "../state/sendDraft";
import { makeStyles, radius, space, type } from "../theme";
import { MAX_ACCOUNT_INDEX } from "../wallet/config";
import { shortAddress } from "../wallet/format";
import * as session from "../wallet/session";
import { errorText } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "Accounts">;

// Accounts derived from the recovery phrase (index 0 to 19). Names are kept
// on this phone only. Switching clears any half-written send.
export function AccountsScreen({ navigation }: Props) {
  const styles = useStyles();
  const { profile } = session.useWallet();
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;
  const full = profile.accounts.length > MAX_ACCOUNT_INDEX;
  const add = async () => {
    try {
      clearAllDrafts();
      await session.addAccount();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <Frame
      title="Accounts"
      onBack={() => navigation.goBack()}
      footer={
        <PrimaryButton label="Add account" disabled={full} onPress={add} />
      }
    >
      <Rows>
        {profile.accounts.map((a) => (
          <Row
            key={a.index}
            label={`${a.label}${a.index === profile.current ? "  ·  In use" : ""}`}
            detail={shortAddress(a.address)}
            onPress={() => {
              clearAllDrafts();
              session.switchAccount(a.index);
              navigation.goBack();
            }}
          />
        ))}
      </Rows>
      {error ? (
        <Banner icon="alert-outline" title="Not added" body={error} />
      ) : null}
      <SectionHeading>Rename</SectionHeading>
      {editing === null ? (
        <GhostButton
          label="Rename the account in use"
          onPress={() => {
            setEditing(profile.current);
            setName(
              profile.accounts.find((a) => a.index === profile.current)
                ?.label ?? "",
            );
          }}
        />
      ) : (
        <View style={styles.rename}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={64}
            style={styles.input}
            accessibilityLabel="Account name"
          />
          <PrimaryButton
            label="Save name"
            onPress={async () => {
              await session.renameAccount(editing, name);
              setEditing(null);
            }}
          />
        </View>
      )}
      <Note>
        One recovery phrase gives up to 20 accounts. Names stay on this phone;
        restoring from your words does not bring them back.
      </Note>
    </Frame>
  );
}

const useStyles = makeStyles((colors) => ({
  rename: { gap: space.sm },
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
}));
