import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePreventScreenCapture } from "expo-screen-capture";
import { useMemo, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Banner } from "../../components/Banner";
import { PrimaryButton, TextButton } from "../../components/Button";
import { GhostButton, Note, Voice } from "../../components/blocks";
import { Page } from "../../components/Page";
import { Seal } from "../../components/Seal";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { fonts, makeStyles, radius, space, type, useColors } from "../../theme";
import { newPhrase, normalizePhrase, quizPositions } from "../../wallet/core";
import * as session from "../../wallet/session";
import { errorText } from "../../wallet/useAsync";

type Props<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

// The phrase being created lives here, in memory, until it is saved or the
// flow is left. It is never put in navigation params or storage.
let pendingPhrase: string | null = null;

export function CreatePhraseScreen({ navigation }: Props<"CreatePhrase">) {
  usePreventScreenCapture();
  const styles = useStyles();
  const phrase = useMemo(() => {
    pendingPhrase = newPhrase();
    return pendingPhrase;
  }, []);
  const [shown, setShown] = useState(false);
  return (
    <Page
      title="Your recovery phrase"
      subtitle="Write these 12 words on paper, in order. Anyone with them can take your funds."
      onBack={() => {
        pendingPhrase = null;
        navigation.goBack();
      }}
      footer={
        <PrimaryButton
          label="I wrote it down"
          disabled={!shown}
          onPress={() => navigation.navigate("ConfirmPhrase")}
        />
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={shown ? "Recovery phrase" : "Show recovery phrase"}
        onPress={() => setShown(true)}
        style={styles.words}
      >
        {shown ? (
          phrase.split(" ").map((w, i) => (
            <View key={i} style={styles.word}>
              <Text style={styles.wordIndex}>{i + 1}</Text>
              <Text style={styles.wordText}>{w}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.reveal}>
            Tap to show. Make sure no one can see your screen.
          </Text>
        )}
      </Pressable>
      <Note>
        There is no copy button on purpose. Mandate cannot recover these words
        for you, and never asks for them.
      </Note>
    </Page>
  );
}

export function ConfirmPhraseScreen({ navigation }: Props<"ConfirmPhrase">) {
  usePreventScreenCapture();
  const styles = useStyles();
  const colors = useColors();
  const words = (pendingPhrase ?? "").split(" ");
  const positions = useMemo(() => quizPositions(words.length), [words.length]);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [passphrase, setPassphrase] = useState("");
  const [usePass, setUsePass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const correct = positions.every(
    (p, i) => answers[i]!.trim().toLowerCase() === words[p],
  );
  const save = async () => {
    if (!pendingPhrase) return;
    setBusy(true);
    setError(null);
    try {
      await session.createWallet(pendingPhrase, usePass ? passphrase : "");
      pendingPhrase = null;
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <Page
      title="Check your words"
      subtitle="Type the words at these positions."
      onBack={() => navigation.goBack()}
      footer={
        <PrimaryButton
          label={busy ? "Saving…" : "Save wallet"}
          disabled={!correct || busy || (usePass && passphrase.length < 1)}
          onPress={save}
        />
      }
    >
      {positions.map((p, i) => (
        <View key={p} style={styles.field}>
          <Text style={styles.label}>Word {p + 1}</Text>
          <TextInput
            value={answers[i]}
            onChangeText={(t) =>
              setAnswers((a) => a.map((x, j) => (j === i ? t : x)))
            }
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            importantForAutofill="no"
            style={styles.input}
            placeholderTextColor={colors.ink3}
          />
        </View>
      ))}
      <PassphraseField
        enabled={usePass}
        onToggle={() => setUsePass((v) => !v)}
        value={passphrase}
        onChange={setPassphrase}
      />
      {error ? (
        <Banner icon="alert-outline" title="Not saved" body={error} />
      ) : null}
    </Page>
  );
}

function PassphraseField({
  enabled,
  onToggle,
  value,
  onChange,
}: {
  enabled: boolean;
  onToggle: () => void;
  value: string;
  onChange: (v: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <TextButton
        label={
          enabled ? "Remove the passphrase" : "Add a passphrase (advanced)"
        }
        onPress={onToggle}
      />
      {enabled ? (
        <>
          <TextInput
            value={value}
            onChangeText={onChange}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            importantForAutofill="no"
            style={styles.input}
            accessibilityLabel="Passphrase"
          />
          <Note>
            The passphrase is not stored on its own. A different passphrase
            opens a different wallet, so write it down with the words.
          </Note>
        </>
      ) : null}
    </View>
  );
}

export function RestoreScreen({ navigation }: Props<"Restore">) {
  usePreventScreenCapture();
  const styles = useStyles();
  const [text, setText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [usePass, setUsePass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const phrase = normalizePhrase(text);
  const restore = async () => {
    if (!phrase) return;
    setBusy(true);
    setError(null);
    try {
      await session.restoreWallet(phrase, usePass ? passphrase : "");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <Page
      title="Restore a wallet"
      subtitle="Enter your 12 or 24 words in order, separated by spaces."
      onBack={() => navigation.goBack()}
      footer={
        <PrimaryButton
          label={busy ? "Restoring…" : "Restore"}
          disabled={!phrase || busy}
          onPress={restore}
        />
      }
    >
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        importantForAutofill="no"
        keyboardType="visible-password"
        style={[styles.input, styles.phraseInput]}
        accessibilityLabel="Recovery phrase"
      />
      <Note>
        {text.trim() === ""
          ? "Only enter your words here, never on a website or in a message."
          : phrase
            ? "These words are a valid recovery phrase."
            : "Not a valid recovery phrase yet. Check the spelling and order."}
      </Note>
      <PassphraseField
        enabled={usePass}
        onToggle={() => setUsePass((v) => !v)}
        value={passphrase}
        onChange={setPassphrase}
      />
      {error ? (
        <Banner icon="alert-outline" title="Not restored" body={error} />
      ) : null}
    </Page>
  );
}

export function LockScreen() {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      await session.unlock();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Mandate is locked"
      subtitle="Unlock with Face ID, Touch ID or your phone's passcode."
      footer={
        <PrimaryButton
          label={busy ? "Unlocking…" : "Unlock"}
          icon="fingerprint"
          disabled={busy}
          onPress={unlock}
        />
      }
    >
      <View style={styles.seal}>
        <Seal size={Math.min(width - space.xl * 2, 220)} />
      </View>
      {error ? (
        <Banner icon="alert-outline" title="Still locked" body={error} />
      ) : null}
      <Note>Locking the app does not stop approved agent work.</Note>
    </Page>
  );
}

export function ShowPhraseScreen({ navigation }: Props<"ShowPhrase">) {
  usePreventScreenCapture();
  const styles = useStyles();
  const [phrase, setPhrase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const show = async () => {
    try {
      setPhrase(await session.readPhraseForBackup());
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <Page
      title="Recovery phrase"
      subtitle="Only look at this somewhere private."
      onBack={() => {
        setPhrase(null);
        navigation.goBack();
      }}
      footer={
        phrase ? undefined : (
          <PrimaryButton label="Show" icon="fingerprint" onPress={show} />
        )
      }
    >
      {phrase ? (
        <View style={styles.words}>
          {phrase.split(" ").map((w, i) => (
            <View key={i} style={styles.word}>
              <Text style={styles.wordIndex}>{i + 1}</Text>
              <Text style={styles.wordText}>{w}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Voice>Your words are hidden until you confirm it is you.</Voice>
      )}
      {error ? (
        <Banner icon="alert-outline" title="Not shown" body={error} />
      ) : null}
      <Note>
        If you added a passphrase, it is not shown here. You need it too.
      </Note>
    </Page>
  );
}

export function SetupChoice({
  onCreate,
  onRestore,
}: {
  onCreate: () => void;
  onRestore: () => void;
}) {
  return (
    <>
      <PrimaryButton label="Create a new wallet" onPress={onCreate} />
      <GhostButton label="I have a recovery phrase" onPress={onRestore} />
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  words: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.raised,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  word: {
    width: "47%",
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.sm,
    paddingVertical: space.xs,
  },
  wordIndex: {
    ...type.small,
    color: colors.ink3,
    width: 22,
    textAlign: "right",
  },
  wordText: { ...type.body, fontFamily: fonts.mono, color: colors.ink },
  reveal: { ...type.body, color: colors.ink2, textAlign: "center" },
  field: { gap: space.xs },
  label: { ...type.small, color: colors.ink2 },
  input: {
    ...type.body,
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.raised,
    color: colors.ink,
  },
  phraseInput: {
    minHeight: 140,
    textAlignVertical: "top",
    fontFamily: fonts.mono,
  },
  seal: { alignItems: "center", paddingVertical: space.xl },
}));
