import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { AppState, Share, Switch, Text, View } from "react-native";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import { GhostButton, Note, Row, Rows } from "../components/blocks";
import { Page } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useServicePoll } from "../state/useServicePoll";
import { makeStyles, space, type } from "../theme";
import {
  getTask,
  getServiceWallet,
  issueAgentToken,
  useApiSession,
} from "../wallet/api";
import { API_ORIGIN } from "../wallet/config";
import { errorText } from "../wallet/useAsync";
import { TaskField } from "./TaskCreate";

type Props = NativeStackScreenProps<RootStackParamList, "AgentToken">;
export function AgentTokenScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const session = useApiSession();
  const { taskId } = route.params;
  const view = useServicePoll(async () => {
    const task = await getTask(taskId);
    await getServiceWallet(task.walletId);
    return task;
  }, `token:${taskId}`);
  const [evidence, setEvidence] = useState(false);
  const [hours, setHours] = useState("1");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const inFlight = useRef(false);
  const tokenBody = useRef<Parameters<typeof issueAgentToken>[0] | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setToken(null);
    setBusy(false);
    setAttempted(false);
    tokenBody.current = null;
    return () => {
      generation.current++;
    };
  }, [session?.owner, session?.sessionId]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") {
        generation.current++;
        setToken(null);
        setBusy(false);
      }
    });
    return () => sub.remove();
  }, []);
  const issue = async () => {
    if (inFlight.current || !view.data || view.error) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const ticket = generation.current;
    try {
      if (!tokenBody.current) {
        const count = Number(hours);
        if (!Number.isFinite(count) || count <= 0 || count > 24)
          throw new Error(
            "Choose an expiry greater than zero and at most 24 hours.",
          );
        tokenBody.current = {
          walletId: view.data.walletId,
          taskId,
          scopes: evidence ? ["read", "run", "evidence"] : ["read", "run"],
          expiresAt: String(Math.floor(Date.now() / 1000 + count * 3600)),
        };
      }
      setAttempted(true);
      const result = await issueAgentToken(tokenBody.current);
      if (ticket === generation.current) setToken(result.token);
    } catch (e) {
      if (ticket === generation.current) setError(errorText(e));
    } finally {
      inFlight.current = false;
      if (ticket === generation.current) setBusy(false);
    }
  };
  const explicit = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <Page
      title="Laptop agent token"
      onBack={() => {
        setToken(null);
        navigation.goBack();
      }}
    >
      <Note>
        This token lets an agent read and run this task within your approved
        permission. Anyone holding it can use those scopes until it expires. It
        is shown once and is not saved by this app.
      </Note>
      <Rows>
        <Row label="Task" detail={taskId} mono />
        <Row label="Required scopes" value="read, run" />
      </Rows>
      {!attempted ? (
        <>
          <TaskField
            label="Expires in hours (up to 24)"
            value={hours}
            onChange={setHours}
            numeric
          />
          <View style={styles.choice}>
            <Text style={styles.label}>Also allow evidence access</Text>
            <Switch
              accessibilityLabel="Allow evidence scope"
              value={evidence}
              onValueChange={setEvidence}
            />
          </View>
        </>
      ) : null}
      {token ? (
        <>
          <Text selectable style={styles.secret}>
            {token}
          </Text>
          <GhostButton
            label="Copy token"
            onPress={() => void explicit(() => Clipboard.setStringAsync(token))}
          />
          <GhostButton
            label="Share token"
            onPress={() => void explicit(() => Share.share({ message: token }))}
          />
          <GhostButton label="Clear token" onPress={() => setToken(null)} />
        </>
      ) : (
        <PrimaryButton
          label={
            busy
              ? "Issuing…"
              : attempted
                ? "Retry same token request"
                : "Issue task token"
          }
          disabled={
            busy || !!view.error || view.data?.authorityState !== "ACTIVE"
          }
          onPress={issue}
        />
      )}
      {view.error || error ? (
        <Banner
          icon="alert-outline"
          title="Token unavailable"
          body={error ?? view.error!}
        />
      ) : null}
      {attempted && !token ? (
        <Note>
          If the response was lost, the server may refuse a duplicate because it
          reveals tokens only once. This retry uses the same request. Clear the
          request only when you intentionally want to issue another token.
        </Note>
      ) : null}
      {attempted && !token ? (
        <GhostButton
          label="Prepare a new token request"
          disabled={busy}
          onPress={() => {
            tokenBody.current = null;
            setAttempted(false);
            setError(null);
          }}
        />
      ) : null}
      <Note>
        On your computer, start apps/agent with MANDATE_API_URL set to{" "}
        {API_ORIGIN}, MANDATE_AGENT_TOKEN set to the token, MANDATE_TASK_ID set
        to {taskId}, and MANDATE_TASK_GOAL set to your goal. Keep the token out
        of logs and source files. Start the laptop process yourself; the phone
        does not launch it.
      </Note>
    </Page>
  );
}
const useStyles = makeStyles((colors) => ({
  choice: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.md,
  },
  label: { ...type.body, color: colors.ink, flex: 1 },
  secret: {
    ...type.body,
    color: colors.ink,
    padding: space.md,
    backgroundColor: colors.raised,
  },
}));
