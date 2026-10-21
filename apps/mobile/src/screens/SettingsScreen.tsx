import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useState } from "react";
import { Alert } from "react-native";
import { Banner } from "../components/Banner";
import { Row, Rows, SectionHeading } from "../components/blocks";
import { Screen } from "../components/Screen";
import { network } from "../config/network";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { clearAllDrafts } from "../state/sendDraft";
import {
  signIn,
  signOut,
  useApiSession,
  useApiConnection,
} from "../wallet/api";
import { API_ORIGIN } from "../wallet/config";
import { readDelivery } from "../wallet/local";
import { deliveryLine } from "../state/delivery";
import * as session from "../wallet/session";
import { errorText, useAsync } from "../wallet/useAsync";

export function SettingsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { profile } = session.useWallet();
  const api = useApiSession();
  const connection = useApiConnection();
  const [error, setError] = useState<string | null>(null);
  const focused = useIsFocused();
  const delivery = useAsync(readDelivery, [focused]);
  const run = (f: () => Promise<void>) => () => {
    setError(null);
    f().catch((e) => setError(errorText(e)));
  };
  const remove = () =>
    Alert.alert(
      "Remove the wallet from this phone?",
      "Your funds and any agent permissions stay on the chain. You can only get this wallet back with your recovery words.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: run(async () => {
            clearAllDrafts();
            await signOut();
            await session.removeWallet();
          }),
        },
      ],
    );
  return (
    <Screen title="Settings">
      {error ? (
        <Banner icon="alert-outline" title="Not done" body={error} />
      ) : null}
      <SectionHeading>Security</SectionHeading>
      <Rows>
        <Row
          label="Recovery phrase"
          detail={
            profile?.backupConfirmed
              ? "Written down and confirmed"
              : "Not confirmed"
          }
          onPress={() => navigation.navigate("ShowPhrase")}
        />
        <Row
          label="Lock now"
          detail="Face ID, Touch ID or the passcode unlocks it. Mandate also locks after a minute in the background."
          onPress={() => {
            clearAllDrafts();
            session.lock();
          }}
        />
        <Row
          label="Remove wallet from this phone"
          detail="Needs your recovery words to restore."
          onPress={remove}
        />
      </Rows>

      <SectionHeading>Mandate service</SectionHeading>
      <Rows>
        {API_ORIGIN === null ? (
          <Row
            label="Sign in"
            detail="The Mandate service address is not configured in this build."
            value="Not configured"
          />
        ) : api ? (
          <Row
            label="Signed in"
            detail={`Until ${new Date(Number(api.expiresAt) * 1000).toLocaleTimeString()}. Signing out does not stop agents.`}
            value="Sign out"
            onPress={run(signOut)}
          />
        ) : (
          <Row
            label="Sign in"
            detail={
              connection.status === "connecting"
                ? "Connecting to the Mandate service…"
                : connection.status === "error"
                  ? connection.error
                  : `Signs a one-time login for ${API_ORIGIN}.`
            }
            onPress={run(signIn)}
          />
        )}
      </Rows>

      <SectionHeading>Wallet</SectionHeading>
      <Rows>
        <Row
          label="Contacts"
          onPress={() => navigation.navigate("Contacts", {})}
        />
        <Row label="Accounts" onPress={() => navigation.navigate("Accounts")} />
        <Row
          label="Delivery address"
          detail={
            delivery.data
              ? deliveryLine(delivery.data)
              : "Needed for Mandate Test Shop orders. Nothing ships."
          }
          value={delivery.data ? undefined : "Add"}
          onPress={() => navigation.navigate("DeliveryAddress")}
        />
        <Row
          label={network.name}
          detail={`Chain ${network.chainId}. Test network only.`}
          value="Configured"
        />
      </Rows>

      {__DEV__ ? (
        <>
          <SectionHeading>Development</SectionHeading>
          <Rows>
            <Row
              label="Design preview"
              detail="Sample-data screens for flows not built yet"
              onPress={() => navigation.navigate("PreviewIndex")}
            />
          </Rows>
        </>
      ) : null}
    </Screen>
  );
}
