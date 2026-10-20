import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/Button";
import {
  GhostButton,
  Note,
  Row,
  Rows,
  SectionHeading,
  Steps,
} from "../components/blocks";
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
import { formatUnitsExact } from "../wallet/service-validation";
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
                    state:
                      w.provisioningState === "KEYGEN"
                        ? "now"
                        : w.provisioningState === "READY"
                          ? "done"
                          : "todo",
                  },
                  {
                    title:
                      w.provisioningState === "FAILED"
                        ? "Provisioning failed"
                        : "Ready for tasks",
                    state:
                      w.provisioningState === "READY"
                        ? "done"
                        : w.provisioningState === "FAILED"
                          ? "now"
                          : "todo",
                  },
                ]}
              />
              <Rows>
                <Row label="Service state" value={w.provisioningState} />
                <Row
                  label="Spendable"
                  value={`${formatUnitsExact(w.spendableUnits)} DemoUSD`}
                />
                <Row
                  label="Liquid / reserved"
                  value={`${formatUnitsExact(w.liquidUnits)} / ${formatUnitsExact(w.reservedUnits)}`}
                />
                <Row label="Floor" value={formatUnitsExact(w.floorUnits)} />
                <Row
                  label="Wallet budget left today"
                  value={formatUnitsExact(w.budgets.walletRemainingUnits)}
                />
                <Row
                  label="Executor budget left today"
                  value={formatUnitsExact(w.budgets.executorRemainingUnits)}
                />
                <Row label="Block" value={w.asOfBlock} />
                <Row
                  label="Control state"
                  detail={`${w.paused ? "Paused" : "Unpaused"} · ${w.frozen ? "Frozen" : "Unfrozen"} · ${w.inhibited ? "Inhibited" : "Not inhibited"}`}
                />
              </Rows>
              {w.provisioningState === "READY" ? (
                <PrimaryButton
                  label="New page check"
                  onPress={() =>
                    navigation.navigate("TaskCreate", { walletId: w.walletId })
                  }
                />
              ) : (
                <Note>
                  Leave this screen and return later to check provisioning.
                  Notifications are not enabled.
                </Note>
              )}
              {approvals.error ? (
                <Banner
                  icon="alert-outline"
                  title="Approvals unavailable"
                  body={approvals.error}
                />
              ) : null}
              {w.address ? (
                <GhostButton
                  label={`Payment approvals${approvals.error ? "" : ` (${pending.length})`}`}
                  onPress={() =>
                    navigation.navigate("Approvals", {
                      wallet: w.address!,
                      walletId: w.walletId,
                    })
                  }
                />
              ) : null}
              <SectionHeading>Tasks known on this phone</SectionHeading>
              {refs.error ? (
                <Note>{refs.error}</Note>
              ) : (refs.data ?? []).filter((t) => t.walletId === w.walletId)
                  .length ? (
                <Rows>
                  {refs
                    .data!.filter((t) => t.walletId === w.walletId)
                    .map((t) => (
                      <Row
                        key={t.taskId}
                        label={t.goal}
                        detail={t.taskId}
                        onPress={() =>
                          navigation.navigate("TaskDetail", {
                            taskId: t.taskId,
                          })
                        }
                      />
                    ))}
                </Rows>
              ) : (
                <Note>No tasks recorded for this wallet on this phone.</Note>
              )}
            </>
          )}
          <GhostButton
            label="Refresh service"
            onPress={() => {
              wallet.reload();
              refs.reload();
              approvals.reload();
            }}
          />
        </>
      )}
    </>
  );
}
