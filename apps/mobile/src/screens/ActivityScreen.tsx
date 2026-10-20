import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { Banner } from "../components/Banner";
import { Chips, GhostButton, Note, Row, Rows, SectionHeading, Voice } from "../components/blocks";
import { Screen } from "../components/Screen";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { activityActor, mergeActivity } from "../state/taskModels";
import { useServicePoll } from "../state/useServicePoll";
import { getActivity, useApiSession } from "../wallet/api";
import { TOKENS } from "../wallet/config";
import { shortAddress } from "../wallet/format";
import { readSent } from "../wallet/local";
import type { WalletActivity, Coverage } from "../wallet/service-dto/activity";
import { formatUnitsExact } from "../wallet/service-validation";
import { currentAccount, useWallet } from "../wallet/session";
import { errorText, useAsync } from "../wallet/useAsync";

type Filter = "all" | "you" | "agent" | "incoming";
export function ActivityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useWallet(); const account = currentAccount(); const api = useApiSession();
  const [filter, setFilter] = useState<Filter>("all");
  const first = useServicePoll(() => getActivity(), `activity:${account?.address}`, 0);
  const sent = useAsync(readSent, [account?.address]);
  const [more, setMore] = useState<WalletActivity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const inFlight = useRef(false); const generation = useRef(0);
  useEffect(() => { generation.current++; setMore([]); setCursor(null); setCoverage(null); setError(null); return () => { generation.current++; }; }, [account?.address, api?.sessionId]);
  useEffect(() => { generation.current++; setMore([]); setCursor(first.data?.nextCursor ?? null); setCoverage(first.data?.coverage ?? null); setError(null); }, [first.data]);
  useFocusEffect(useCallback(() => { sent.reload(); first.reload(); }, [sent.reload, first.reload]));
  const loadMore = async () => {
    if (!cursor || inFlight.current) return;
    const ticket = generation.current; inFlight.current = true; setLoadingMore(true); setError(null);
    try { const page = await getActivity(cursor); if (ticket === generation.current) { setMore((items) => [...items, ...page.items]); setCursor(page.nextCursor); setCoverage(page.coverage); } }
    catch (e) { if (ticket === generation.current) setError(errorText(e)); }
    finally { inFlight.current = false; if (ticket === generation.current) setLoadingMore(false); }
  };
  const merged = mergeActivity([...(first.data?.items ?? []), ...more], sent.data ?? [], account?.address ?? "");
  const indexed = merged.indexed.filter((item) => filter === "all" || activityActor(item).toLowerCase() === filter);
  const local = filter === "all" || filter === "you" ? merged.local : [];
  return <Screen title="Activity">
    <Chips<Filter> options={[{ key: "all", label: "All" }, { key: "you", label: "You" }, { key: "agent", label: "Agent" }, { key: "incoming", label: "Incoming" }]} selected={filter} onSelect={setFilter} />
    {first.error ? <Banner icon="cloud-off-outline" title="Service activity unavailable" body={first.error} /> : !api ? <Note>Sign in to the service in Settings for indexed activity.</Note> : null}
    {indexed.length ? <Rows>{indexed.map((item) => {
      const token = TOKENS.find((t) => t.address?.toLowerCase() === item.asset.toLowerCase());
      return <Row key={item.activityId} label={`${activityActor(item)} · ${item.category}`} detail={`${item.state} · ${item.provenance}\n${item.source} · ${shortAddress(item.to)}\n${item.txHash}`} value={token ? `${formatUnitsExact(item.amount, token.decimals)} ${token.symbol}` : `${item.amount} base units`} onPress={() => navigation.navigate("TxDetail", { hash: item.txHash, origin: item.source === "MANAGED" && activityActor(item) === "Agent" ? "agent" : "service", ...(item.taskId ? { taskId: item.taskId } : {}) })} />;
    })}</Rows> : null}
    {indexed.filter((i) => i.taskId).length ? <><SectionHeading>Tasks in this page</SectionHeading><Rows>{[...new Set(indexed.flatMap((i) => i.taskId ? [i.taskId] : []))].map((taskId) => <Row key={taskId} label="View task" detail={taskId} onPress={() => navigation.navigate("TaskDetail", { taskId })} />)}</Rows></> : null}
    {local.length ? <><SectionHeading>Sent here; not indexed yet</SectionHeading><Rows>{local.map((t) => <Row key={t.hash} label={`You · ${t.label}`} detail={`${new Date(t.createdAt).toLocaleString()} · LOCAL_JOURNAL\n${t.hash}`} value={t.kind === "send" ? `${t.amount} ${t.symbol}` : undefined} onPress={() => navigation.navigate("TxDetail", { hash: t.hash, origin: "phone" })} />)}</Rows><Note>Local rows record submission from this phone. Open a row to read its current chain receipt.</Note></> : null}
    {!indexed.length && !local.length ? <Voice>{first.loading && api ? "Loading activity…" : "No activity in this view."}</Voice> : null}
    {coverage ? <Note>Service coverage: blocks {coverage.fromBlock}–{coverage.toBlock}; indexed through {coverage.indexedThrough ?? "not reported"}. Backfill: {coverage.backfillState}. {coverage.gaps.length ? `Gaps: ${coverage.gaps.map((g) => `${g.fromBlock}–${g.toBlock}`).join(", ")}.` : "No gaps reported in that block range."} This is the reported range; it does not establish coverage outside it.</Note> : null}
    {cursor ? <GhostButton label={loadingMore ? "Loading…" : "Load more"} disabled={loadingMore} onPress={loadMore} /> : null}
    {error || sent.error ? <Note>{error ?? sent.error}</Note> : null}
    <GhostButton label="Refresh" onPress={() => { first.reload(); sent.reload(); }} />
  </Screen>;
}
