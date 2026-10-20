import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton, TextButton } from "../components/Button";
import { GhostButton, Note, Row, Rows } from "../components/blocks";
import { Page } from "../components/Page";
import { Seal } from "../components/Seal";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { makeStyles, space, type } from "../theme";

// First-run flow: Welcome -> Set up your wallet -> app. Creating and restoring
// a wallet run on native screens that are not built yet, so setup only says so;
// nothing here collects recovery words.

type Props<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

const HOW_IT_WORKS = [
  "Your wallet stays on this phone",
  "Agents get a separate wallet",
  "You can always stop them",
  "Test network only",
] as const;

export function WelcomeScreen({ navigation }: Props<"Welcome">) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sealSize = Math.min(width - space.xl * 2, 230);
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sealRow}>
          <Seal size={sealSize} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Your agent. Your money. Real work.
        </Text>
        <Rows>
          {HOW_IT_WORKS.map((line) => (
            <Row key={line} label={line} />
          ))}
        </Rows>
        <Note>Preview build. Wallet features are not built yet.</Note>
      </ScrollView>
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}
      >
        <PrimaryButton
          label="Get started"
          onPress={() => navigation.navigate("Setup")}
        />
        <TextButton
          label="I have a recovery phrase"
          accessibilityHint="Shows how restoring a wallet will work"
          onPress={() => navigation.navigate("Setup")}
        />
      </View>
    </View>
  );
}

export function SetupScreen({ navigation }: Props<"Setup">) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const sealSize = Math.min(width - space.xl * 2, 220);
  return (
    <Page
      title="Set up your wallet"
      subtitle="The keys stay on this phone. Mandate never sees your recovery phrase."
      onBack={() => navigation.goBack()}
      footer={
        <>
          <PrimaryButton
            label="Create a new wallet"
            disabled
            accessibilityHint="Not available in this build"
          />
          <GhostButton label="I have a recovery phrase" disabled />
          <Note>Preview build. Creating a wallet is not built yet.</Note>
          <TextButton
            label="Explore the preview"
            accessibilityHint="Opens the app without a wallet"
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: "Tabs" }] })
            }
          />
        </>
      }
    >
      <View style={styles.setupSeal}>
        <Seal size={sealSize} />
      </View>
    </Page>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  content: {
    paddingTop: space.lg,
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  sealRow: { alignItems: "center", paddingVertical: space.sm },
  title: { ...type.title, color: colors.ink },
  footer: { paddingTop: space.md, paddingHorizontal: space.xl, gap: space.xs },
  setupSeal: { alignItems: "center", paddingTop: space.xxxl },
}));
