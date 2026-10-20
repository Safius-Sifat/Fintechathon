import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Banner } from "../components/Banner";
import {
  Chips,
  GhostButton,
  HoldToSeal,
  Note,
  Row,
  Rows,
  SectionHeading,
} from "../components/blocks";
import { Page } from "../components/Page";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fonts, makeStyles, radius, space, type, useColors } from "../theme";
import { balanceOf, ownerTransfer, readPolicy } from "../wallet/chain";
import { AGENT_ASSETS, POLICY_CEILINGS, TOKENS } from "../wallet/config";
import { checkAddress, checkAmount } from "../wallet/core";
import { formatAmount, shortAddress, tokenByName } from "../wallet/format";
import { readSignedLists } from "../wallet/local";
import { applyPolicy } from "../wallet/relay";
import { currentAccount } from "../wallet/session";
import { checkPolicy, type AssetCap } from "../wallet/typed";
import { errorText, useAsync } from "../wallet/useAsync";
import { formatUnits, type Address } from "viem";

type MoveProps = NativeStackScreenProps<RootStackParamList, "OwnerMoveOut">;
type Asset = "DemoUSD" | "ETH" | "USDC";

// Moves funds out of the agent wallet with a signed OwnerTransfer (valid ten
// minutes). The contract then pauses the wallet and ends earlier approvals.
export function OwnerMoveOutScreen({ navigation, route }: MoveProps) {
  const styles = useStyles();
  const colors = useColors();
  const { wallet } = route.params;
  const account = currentAccount()!;
  const [asset, setAsset] = useState<Asset>("DemoUSD");
  const [to, setTo] = useState<string>(account.address);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const token = tokenByName(asset);
  const available = useAsync(() => balanceOf(token, wallet), [asset, wallet]);
  const toCheck = checkAddress(to);
  const amountCheck = checkAmount(amount, token.decimals);
  const tooMuch =
    amountCheck.ok &&
    available.data !== undefined &&
    amountCheck.value > available.data;
  const toWallet =
    toCheck.ok && toCheck.value.toLowerCase() === wallet.toLowerCase();
  const ready = toCheck.ok && amountCheck.ok && !tooMuch && !toWallet;
  const sign = async () => {
    if (!toCheck.ok || !amountCheck.ok) return;
    try {
      const hash = await ownerTransfer({
        wallet,
        token,
        recipient: toCheck.value,
        amount: amountCheck.value,
        amountText: amount,
        owner: account.address,
      });
      navigation.replace("TxDetail", { hash });
    } catch (e) {
      setError(errorText(e));
      setKey((k) => k + 1);
    }
  };
  const problem =
    to && !toCheck.ok
      ? toCheck.error
      : toWallet
        ? "That is the agent wallet itself."
        : amount && !amountCheck.ok
          ? amountCheck.error
          : tooMuch
            ? "More than the agent wallet holds."
            : null;
  return (
    <Page
      title="Move funds out"
      subtitle="Signed on this phone. Works without the Mandate service."
      onBack={() => navigation.goBack()}
      footer={
        <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
      }
    >
      <Chips<Asset>
        options={[
          { key: "DemoUSD", label: "DemoUSD" },
          { key: "ETH", label: "ETH" },
          { key: "USDC", label: "USDC" },
        ]}
        selected={asset}
        onSelect={setAsset}
      />
      <View style={styles.field}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.ink3}
          style={styles.input}
        />
        <Note>
          {available.data !== undefined
            ? `In the agent wallet: ${formatAmount(available.data, token.decimals)} ${token.symbol}`
            : "Reading the agent wallet balance…"}
        </Note>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>To</Text>
        <TextInput
          value={to}
          onChangeText={setTo}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.mono]}
        />
        <Note>
          {toCheck.ok && toCheck.value === account.address
            ? "Your own account."
            : "Another address. Check it carefully."}
        </Note>
      </View>
      {problem ? (
        <Banner icon="alert-outline" title="Check this" body={problem} />
      ) : null}
      <Rows>
        <Row label="From" value={shortAddress(wallet)} mono />
        <Row label="After it is on the chain" value="All agents paused" />
        <Row label="Earlier approvals" value="End for good" />
        <Row label="Valid for" value="10 minutes" />
        <Row label="Fee" value="Paid in ETH from your account" />
      </Rows>
      {error ? (
        <Banner icon="alert-outline" title="Not moved" body={error} />
      ) : null}
      <HoldToSeal
        key={key}
        label="Press and hold to move"
        disabled={!ready}
        onSealed={sign}
      />
    </Page>
  );
}

type LimitProps = NativeStackScreenProps<RootStackParamList, "WalletLimits">;

interface CapText {
  perTx: string;
  daily: string;
  weekly: string;
}

const toText = (v: bigint, decimals: number) => formatUnits(v, decimals);

// Edits the agent wallet's limits and signs a new WalletPolicy. The tightest
// rule wins; each limit must fit the contract ceilings.
export function WalletLimitsScreen({ navigation, route }: LimitProps) {
  const styles = useStyles();
  const colors = useColors();
  const { wallet } = route.params;
  const account = currentAccount()!;
  const current = useAsync(
    async () => ({
      policy: await readPolicy(wallet),
      lists: await readSignedLists(wallet),
    }),
    [wallet],
  );
  const [caps, setCaps] = useState<Record<string, CapText> | null>(null);
  const [threshold, setThreshold] = useState<string | null>(null);
  const [allow, setAllow] = useState<Address[] | null>(null);
  const [block, setBlock] = useState<Address[] | null>(null);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  if (current.data && caps === null) {
    const next: Record<string, CapText> = {};
    for (const c of current.data.policy.caps) {
      const t = TOKENS.find((x) => x.address === c.asset)!;
      next[t.name] = c.set
        ? {
            perTx: toText(c.perTx, t.decimals),
            daily: toText(c.daily, t.decimals),
            weekly: toText(c.weekly, t.decimals),
          }
        : { perTx: "", daily: "", weekly: "" };
    }
    setCaps(next);
    // No threshold (max uint) asks for nothing; at the per-payment ceiling
    // that is the same rule, shown as a readable amount.
    const th = current.data.policy.reviewThreshold;
    setThreshold(
      toText(th > POLICY_CEILINGS.perTx ? POLICY_CEILINGS.perTx : th, 6),
    );
    // Keep addresses added while the chain read was still loading.
    const lists = current.data.lists;
    setAllow((l) => [...(lists?.allowlist ?? []), ...(l ?? [])]);
    setBlock((l) => [...(lists?.blocklist ?? []), ...(l ?? [])]);
  }

  const parsed = (() => {
    if (!caps || threshold === null || !allow || !block) return null;
    const assetCaps: AssetCap[] = [];
    for (const t of AGENT_ASSETS) {
      const c = caps[t.name]!;
      if (!c.perTx && !c.daily && !c.weekly) continue;
      if (!c.perTx || !c.daily || !c.weekly)
        return {
          error: `Fill in all three ${t.name} limits, or leave all three empty.`,
        };
      const vals = [c.perTx, c.daily, c.weekly].map((x) =>
        checkAmount(x, t.decimals),
      );
      if (vals.some((v) => !v.ok))
        return { error: `Check the ${t.name} limits.` };
      const [perTx, daily, weekly] = vals.map(
        (v) => (v as { value: bigint }).value,
      ) as [bigint, bigint, bigint];
      assetCaps.push({ asset: t.address!, perTx, daily, weekly });
    }
    const th =
      threshold.trim() === "" || threshold.trim() === "0"
        ? 0n
        : checkAmount(threshold, 6);
    const reviewThreshold =
      typeof th === "bigint" ? th : th.ok ? th.value : -1n;
    if (reviewThreshold < 0n) return { error: "Check the approval limit." };
    const lists = { assetCaps, allowlist: allow, blocklist: block };
    const problem = checkPolicy(lists, reviewThreshold);
    return problem ? { error: problem } : { lists, reviewThreshold };
  })();

  const sign = async () => {
    if (!parsed || "error" in parsed) return;
    try {
      const hash = await applyPolicy({
        wallet,
        owner: account.address,
        ...parsed,
      });
      navigation.replace("TxDetail", { hash });
    } catch (e) {
      setError(errorText(e));
      setKey((k) => k + 1);
    }
  };

  const addEntry = (list: "allow" | "block") => {
    const c = checkAddress(entry);
    if (!c.ok) return setError(c.error);
    setError(null);
    if (list === "allow") setAllow((l) => [...(l ?? []), c.value]);
    else setBlock((l) => [...(l ?? []), c.value]);
    setEntry("");
  };

  return (
    <Page
      title="Wallet limits"
      subtitle="The tightest rule wins. A task can never go above these."
      onBack={() => navigation.goBack()}
      footer={
        <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
      }
    >
      {current.error ? (
        <Banner
          icon="cloud-off-outline"
          title="Could not read the limits"
          body={current.error}
        />
      ) : null}
      {current.loading && !caps ? (
        <Note>Reading the current limits from the chain…</Note>
      ) : null}
      {caps
        ? AGENT_ASSETS.map((t) => (
            <View key={t.name} style={styles.field}>
              <SectionHeading>{t.name}</SectionHeading>
              {(["perTx", "daily", "weekly"] as const).map((k) => (
                <View key={k} style={styles.inline}>
                  <Text style={styles.inlineLabel}>
                    {k === "perTx"
                      ? "Per payment"
                      : k === "daily"
                        ? "Each day"
                        : "Each week"}
                  </Text>
                  <TextInput
                    value={caps[t.name]![k]}
                    onChangeText={(v) =>
                      setCaps((c) => ({
                        ...c!,
                        [t.name]: { ...c![t.name]!, [k]: v },
                      }))
                    }
                    keyboardType="decimal-pad"
                    placeholder={
                      k === "perTx"
                        ? "0.50 max"
                        : k === "daily"
                          ? "10.00 max"
                          : "25.00 max"
                    }
                    placeholderTextColor={colors.ink3}
                    style={[styles.input, styles.inlineInput]}
                  />
                </View>
              ))}
              <Note>
                Leave all three empty to turn {t.name} off for agents.
              </Note>
            </View>
          ))
        : null}
      {threshold !== null ? (
        <View style={styles.inline}>
          <Text style={styles.inlineLabel}>Ask me first above</Text>
          <TextInput
            value={threshold}
            onChangeText={setThreshold}
            keyboardType="decimal-pad"
            style={[styles.input, styles.inlineInput]}
          />
        </View>
      ) : null}
      <SectionHeading>Who agents may pay</SectionHeading>
      <Rows>
        {(allow ?? []).map((a) => (
          <Row
            key={`a${a}`}
            label={`Allowed ${shortAddress(a)}`}
            value="Remove"
            onPress={() => setAllow((l) => l!.filter((x) => x !== a))}
          />
        ))}
        {(block ?? []).map((a) => (
          <Row
            key={`b${a}`}
            label={`Blocked ${shortAddress(a)}`}
            value="Remove"
            onPress={() => setBlock((l) => l!.filter((x) => x !== a))}
          />
        ))}
      </Rows>
      <TextInput
        value={entry}
        onChangeText={setEntry}
        placeholder="0x… address"
        placeholderTextColor={colors.ink3}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, styles.mono]}
      />
      <View style={styles.pair}>
        <View style={styles.half}>
          <GhostButton label="Allow" onPress={() => addEntry("allow")} />
        </View>
        <View style={styles.half}>
          <GhostButton label="Block" onPress={() => addEntry("block")} />
        </View>
      </View>
      <Note>
        {allow && allow.length === 0
          ? "With no allowed addresses, agents may pay anyone not blocked."
          : "Agents may pay only the allowed addresses."}{" "}
        Signing replaces every earlier list, and removes any call templates.
        Ceilings: {formatAmount(POLICY_CEILINGS.perTx, 6)} per payment,{" "}
        {formatAmount(POLICY_CEILINGS.daily, 6)} a day,{" "}
        {formatAmount(POLICY_CEILINGS.weekly, 6)} a week.
      </Note>
      {parsed && "error" in parsed ? (
        <Banner icon="alert-outline" title="Check this" body={parsed.error!} />
      ) : null}
      {error ? (
        <Banner icon="alert-outline" title="Not signed" body={error} />
      ) : null}
      <HoldToSeal
        key={key}
        label="Press and hold to sign limits"
        disabled={!parsed || "error" in parsed}
        onSealed={sign}
      />
    </Page>
  );
}

const useStyles = makeStyles((colors) => ({
  field: { gap: space.sm },
  label: { ...type.small, color: colors.ink2 },
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
  inline: { flexDirection: "row", alignItems: "center", gap: space.md },
  inlineLabel: { ...type.body, color: colors.ink, flex: 1 },
  inlineInput: { width: 140, textAlign: "right" },
  pair: { flexDirection: "row", gap: space.md },
  half: { flex: 1 },
}));
