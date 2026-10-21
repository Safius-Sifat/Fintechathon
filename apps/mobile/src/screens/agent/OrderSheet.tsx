import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "../../components/Button";
import { HoldToSeal } from "../../components/blocks";
import { CardLine } from "../../components/chat";
import { deliveryHash, deliveryLine } from "../../state/delivery";
import { orderTerms } from "../../state/agentThread";
import { taskTerms } from "../../state/taskModels";
import { radius, space, type, makeStyles } from "../../theme";
import {
  activatePermit,
  draftPermit,
  listProviders,
  permitContext,
  type OwnerApproval,
  type Terms,
} from "../../wallet/api";
import { TOKENS } from "../../wallet/config";
import { readDelivery, type DeliveryAddress } from "../../wallet/local";
import { validatePermitDraft } from "../../wallet/service-validation";
import type { ShopProduct } from "../../wallet/service-dto/provider";
import { errorText } from "../../wallet/useAsync";
import { usdc } from "./cards";

const USDC = TOKENS.find((t) => t.symbol === "USDC")!.address!;

export interface OrderRequest {
  taskId: string;
  product: ShopProduct;
  size: string | null;
  amount: string;
  preparedAt: number;
}

// The owner's approval for one shop order, as a sheet over the chat. The
// service drafts a Permit for exactly one USDC payment of the price to the
// shop; this phone checks the draft commits to the order shown, then you
// sign with the hold seal.
export function OrderSheet({
  order,
  onClose,
  onSigned,
  onAddAddress,
}: {
  order: OrderRequest;
  onClose: () => void;
  onSigned: () => void;
  onAddAddress: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [address, setAddress] = useState<DeliveryAddress | null>();
  const [review, setReview] = useState<{
    draft: OwnerApproval;
    terms: Terms;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [holdKey, setHoldKey] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    readDelivery()
      .then(setAddress)
      .catch((e) => setError(errorText(e)));
  }, []);

  const expected = (a: DeliveryAddress) => ({
    productId: order.product.productId,
    size: order.size,
    amount: order.amount,
    deliveryHash: deliveryHash(a),
  });
  const run = async (work: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(errorText(e));
      setHoldKey((k) => k + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const check = () =>
    run(async () => {
      if (!address) return;
      const terms = taskTerms(orderTerms(await listProviders(), order), USDC);
      const draft = await draftPermit(order.taskId, terms);
      const context = {
        ...(await permitContext(order.taskId, terms)),
        order: expected(address),
      };
      setReview({ draft: validatePermitDraft(draft, context), terms });
    });
  const approve = () =>
    run(async () => {
      if (!review || !address) return;
      await activatePermit(
        review.draft,
        order.taskId,
        review.terms,
        expected(address),
      );
      onSigned();
    });

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.layer}>
        <Pressable
          style={styles.scrim}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={busy ? undefined : onClose}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
        >
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            Approve this order
          </Text>
          <CardLine label="Item" value={order.product.name} />
          {order.size ? <CardLine label="Size" value={order.size} /> : null}
          <CardLine label="Price" value={usdc(order.amount)} />
          <CardLine label="Shop" value="Mandate Test Shop" />
          <CardLine
            label="Deliver to"
            value={
              address
                ? deliveryLine(address)
                : address === null
                  ? "No address saved"
                  : "…"
            }
          />
          <Text style={styles.note}>
            Your agent wallet makes one payment of {usdc(order.amount)} to the
            shop and keeps at least 3 USDC. Test shop – no goods ship.
          </Text>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {address === null ? (
            <PrimaryButton
              label="Add a delivery address"
              onPress={onAddAddress}
            />
          ) : review ? (
            <HoldToSeal
              key={holdKey}
              sealSize={72}
              label={busy ? "Approving…" : `Hold to pay ${usdc(order.amount)}`}
              disabled={busy}
              onSealed={approve}
            />
          ) : (
            <PrimaryButton
              label={busy ? "Checking…" : "Check and approve"}
              disabled={busy || !address}
              onPress={check}
            />
          )}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onClose}
            hitSlop={8}
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  layer: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  sheet: {
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.raised,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.rule,
  },
  title: { ...type.heading, color: colors.ink },
  note: { ...type.small, color: colors.ink3 },
  error: { ...type.body, color: colors.bad },
  cancel: { alignSelf: "center", minHeight: 36, justifyContent: "center" },
  cancelText: { ...type.bodyStrong, color: colors.ink2 },
}));
