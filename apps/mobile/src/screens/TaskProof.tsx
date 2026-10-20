import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import { GhostButton, Note, Row, Rows, SectionHeading } from "../components/blocks";
import { Page } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useServicePoll } from "../state/useServicePoll";
import { downloadProof, getTask, getServiceWallet, useApiSession } from "../wallet/api";
import { errorText } from "../wallet/useAsync";

type Props = NativeStackScreenProps<RootStackParamList, "TaskProof">;
export function TaskProofScreen({ navigation, route }: Props) {
  const { taskId } = route.params; const session = useApiSession();
  const task = useServicePoll(async () => { const value = await getTask(taskId); await getServiceWallet(value.walletId); return value; }, `proof:${taskId}`);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const file = useRef<File | null>(null); const inFlight = useRef(false); const generation = useRef(0);
  useEffect(() => { generation.current++; return () => { generation.current++; if (file.current?.exists) file.current.delete(); file.current = null; }; }, [session?.sessionId]);
  const exportProof = async () => {
    if (inFlight.current || !task.data || task.error) return;
    inFlight.current = true; setBusy(true); setError(null); const ticket = generation.current;
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error("File sharing is not available on this device.");
      const bytes = await downloadProof(taskId);
      if (ticket !== generation.current) return;
      const output = new File(Paths.cache, `mandate-proof-${taskId}.zip`);
      if (output.exists) output.delete();
      output.create(); output.write(bytes); file.current = output;
      await Sharing.shareAsync(output.uri, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle: "Share task proof" });
    } catch (e) { if (ticket === generation.current) setError(errorText(e)); }
    finally { if (file.current?.exists) file.current.delete(); file.current = null; inFlight.current = false; if (ticket === generation.current) setBusy(false); }
  };
  return <Page title="Proof" subtitle="Findings reported by the Mandate service" onBack={() => navigation.goBack()}>
    <Note>The phone has not independently verified this bundle. The statements below are the service's assertions, including any PASS state.</Note>
    {task.error ? <Banner icon="cloud-off-outline" title="Findings unavailable" body={task.error} /> : null}
    {task.data ? <>
      <Rows><Row label="Task result" value={task.data.outcomeState} /><Row label="Authority" value={task.data.authorityState} /><Row label="Delivery" value={task.data.delivery.state} /></Rows>
      <SectionHeading>Service findings</SectionHeading>
      {task.data.findings.length ? <Rows>{task.data.findings.map((f) => <Row key={f.name} label={`${f.name}: service says ${f.state}`} detail={`${f.reason}\nRule ${f.ruleId}; basis: ${f.basis.join(", ") || "none"}\nEvidence IDs: ${f.evidenceIds.join(", ") || "none"}`} />)}</Rows> : <Note>No findings reported yet.</Note>}
      <Note>{task.data.outcomeState === "COMPLETED" ? "Export may still contain pending findings or incomplete chain coverage. Review it independently." : "Task is not complete. If the service supports it, export will contain the partial record available now."}</Note>
      <PrimaryButton label={busy ? "Preparing ZIP…" : "Export proof ZIP"} disabled={busy || !!task.error} onPress={exportProof} />
    </> : null}
    {error ? <Banner icon="alert-outline" title="Export unavailable" body={error} /> : null}
    <SectionHeading>Independent check on a computer</SectionHeading>
    <Note>Use packages/verifier with a trusted deployment manifest and independent RPC:</Note>
    <Note>mandate-verify --bundle &lt;zip&gt; --trusted &lt;manifest&gt; --rpc &lt;url&gt;</Note>
    <Note>The app downloads through your authenticated session, saves a temporary ZIP in its cache and opens the system share sheet. You choose where to send it.</Note>
    <GhostButton label="Refresh findings" onPress={task.reload} />
  </Page>;
}
