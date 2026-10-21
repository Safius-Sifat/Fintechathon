import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { bytesToHex } from "viem";
import { PrimaryButton } from "../components/Button";
import { GhostButton, Note } from "../components/blocks";
import { Frame } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, radius, space, type, useColors } from "../theme";
import {
  readDelivery,
  removeDelivery,
  writeDelivery,
  type DeliveryAddress,
} from "../wallet/local";
import { useAsync } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryAddress">;

const FIELDS: readonly [
  Exclude<keyof DeliveryAddress, "salt">,
  string,
  number,
][] = [
  ["name", "Name", 64],
  ["line1", "Street and number", 96],
  ["city", "City", 64],
  ["postcode", "Postcode", 16],
  ["country", "Country", 48],
];

const blank = { name: "", line1: "", city: "", postcode: "", country: "" };

// The address the agent uses for Mandate Test Shop orders. It stays on this
// phone; an order carries only its salted hash. Nothing ships.
export function DeliveryAddressScreen({ navigation }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const saved = useAsync(readDelivery, []);
  const [form, setForm] = useState(blank);
  useEffect(() => {
    if (saved.data) {
      const { salt: _salt, ...fields } = saved.data;
      setForm(fields);
    }
  }, [saved.data]);
  const complete = Object.values(form).every((v) => v.trim());
  const save = async () => {
    const salt = new Uint8Array(32);
    crypto.getRandomValues(salt);
    await writeDelivery({
      name: form.name.trim(),
      line1: form.line1.trim(),
      city: form.city.trim(),
      postcode: form.postcode.trim(),
      country: form.country.trim(),
      salt: bytesToHex(salt),
    });
    navigation.goBack();
  };
  return (
    <Frame title="Delivery address" onBack={() => navigation.goBack()}>
      <Note>
        For Mandate Test Shop orders. The address stays on this phone; an order
        carries only a salted fingerprint of it. Test shop – no goods ship.
      </Note>
      <View style={styles.form}>
        {FIELDS.map(([key, label, max]) => (
          <TextInput
            key={key}
            value={form[key]}
            onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
            placeholder={label}
            accessibilityLabel={label}
            placeholderTextColor={colors.ink3}
            maxLength={max}
            autoCapitalize={key === "postcode" ? "characters" : "words"}
            autoComplete="off"
            style={styles.input}
          />
        ))}
        <PrimaryButton
          label="Save address"
          disabled={!complete}
          onPress={save}
        />
        {saved.data ? (
          <GhostButton
            label="Remove the address"
            onPress={async () => {
              await removeDelivery();
              navigation.goBack();
            }}
          />
        ) : null}
      </View>
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
}));
