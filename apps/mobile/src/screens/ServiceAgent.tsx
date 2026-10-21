import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import { Note, SectionHeading, Steps } from "../components/blocks";
import { Group, IconRow } from "../components/Group";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useServicePoll } from "../state/useServicePoll";
import {
  createServiceWallet,
  listApprovals,
  registeredServiceWallet,
  serviceTaskReferences,
  useApiConnection,
  useApiSession,
} from "../wallet/api";
import { formatAmount } from "../wallet/format";

const dusd = (units: string) => formatAmount(BigInt(units), 6);
import { errorText } from "../wallet/useAsync";

export function ServiceAgent() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const api = useApiSession();
  const connection = useApiConnection();
  const wallet = useServicePoll(registeredServiceWallet, "service-wallet");
  const refs = useServicePoll(serviceTaskReferences, "known-tasks");
  const approvals = useServicePoll(listApprovals, "pending-approvals");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const register = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await createServiceWallet();
      wallet.reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const w = wallet.data;
  const pending = (approvals.data ?? []).filter(
    (a) => a.state === "PENDING" && a.walletId === w?.walletId,
  );
  return (
    <>
      <SectionHeading>Mandate service</SectionHeading>
      {!api ? (
        <Note>
          {connection.status === "error"
            ? connection.error
            : "Sign in to the service in Settings to register this account's agent wallet and run tasks."}
        </Note>
      ) : (
        <>
          {wallet.error ? (
            <Banner
              icon="cloud-off-outline"
              title="Service wallet unavailable"
              body={wallet.error}
            />
          ) : null}
          {error ? (
            <Banner
              icon="alert-outline"
              title="Registration not confirmed"
              body={error}
            />
          ) : null}
          {!w ? (
            <>
              <Note>
                Register this owner's wallet with the service. The service can
                reuse the wallet already recorded by the on-chain factory.
              </Note>
              <PrimaryButton
                label={busy ? "Registering…" : "Register agent wallet"}
                disabled={busy || wallet.loading}
                onPress={register}
              />
            </>
          ) : (
            <>
              {w.provisioningState !== "READY" ? (
                <Steps
                  items={[
                    {
                      title: "Wallet deployment",
                      state:
                        w.provisioningState === "DEPLOYING"
                          ? "now"
                          : w.address
                            ? "done"
                            : "todo",
                    },
                    {
                      title: "Executor provisioning",
                      state: w.provisioningState === "KEYGEN" ? "now" : "todo",
                    },
                    {
                      title:
                        w.provisioningState === "FAILED"
                          ? "Provisioning failed"
                          : "Ready for tasks",
                      state:
                        w.provisioningState === "FAILED" ? "failed" : "todo",
                    },
                  ]}
                />
              ) : null}
              {approvals.error ? (
                <Banner
                  icon="alert-outline"
                  title="Approvals unavailable"
                  body={approvals.error}
                />
              ) : null}
              <Group>
                <IconRow
                  icon={
                    w.provisioningState === "READY"
                      ? "cloud-check-outline"
                      : "cloud-sync-outline"
                  }
                  tint={w.provisioningState === "READY" ? "good" : "warn"}
                  title={
                    w.provisioningState === "READY" ? "Connected" : "Setting up"
                  }
                  detail={
                    w.inhibited
                      ? "New agent work is held"
                      : `Block ${w.asOfBlock}`
                  }
                />
                <IconRow
                  icon="wallet-outline"
                  title="Agents can spend now"
                  detail={`Keeps ${dusd(w.floorUnits)} · ${dusd(w.reservedUnits)} reserved`}
                  value={`${dusd(w.spendableUnits)}`}
                />
                <IconRow
                  icon="calendar-today"
                  title="Budget left today"
                  value={dusd(w.budgets.walletRemainingUnits)}
                />
                {w.address ? (
                  <IconRow
                    icon="check-decagram-outline"
                    title="Payment approvals"
                    value={approvals.error ? undefined : String(pending.length)}
                    onPress={() =>
                      navigation.navigate("Approvals", {
                        wallet: w.address!,
                        walletId: w.walletId,
                      })
                    }
                  />
                ) : null}
              </Group>
              {(refs.data ?? []).filter((t) => t.walletId === w.walletId)
                .length ? (
                <>
                  <SectionHeading>Run from a laptop</SectionHeading>
                  <Group>
                    {(refs.data ?? [])
                      .filter((t) => t.walletId === w.walletId)
                      .map((t) => (
                        <IconRow
                          key={t.taskId}
                          icon="laptop"
                          title={t.goal}
                          onPress={() =>
                            navigation.navigate("AgentToken", {
                              taskId: t.taskId,
                            })
                          }
                        />
                      ))}
                  </Group>
                </>
              ) : null}
            </>
          )}
        </>
      )}
    </>
  );
}
