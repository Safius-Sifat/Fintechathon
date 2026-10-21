import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { PrimaryButton } from "../../components/Button";
import { HoldToSeal } from "../../components/blocks";
import { CardLine } from "../../components/chat";
import { Icon } from "../../components/Icon";
import { defaultTerms } from "../../state/agentThread";
import {
  decimalUnits,
  taskTerms,
  type TermsForm,
} from "../../state/taskModels";
import { radius, space, type, makeStyles, useColors } from "../../theme";
import {
  activatePermit,
  draftPermit,
  listProviders,
  permitContext,
  type OwnerApproval,
  type Provider,
  type Terms,
} from "../../wallet/api";
import { TOKENS } from "../../wallet/config";
import { formatAmount } from "../../wallet/format";
import { validatePermitDraft } from "../../wallet/service-validation";
import { errorText } from "../../wallet/useAsync";

type MoneyKey = "maxPayment" | "spendCap" | "reviewThreshold";
// Opacities of the bands that fade the hidden lines into the sheet.
const FADE = [0.15, 0.35, 0.55, 0.75, 0.9, 1] as const;
// "0.350000" reads as "0.35" in a field.
const trim = (v: string) => v.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

const MONEY: readonly [MoneyKey, string][] = [
  ["maxPayment", "Most per payment"],
  ["spendCap", "Most for this task"],
  ["reviewThreshold", "Ask me first above"],
];

// The agent's request to spend, as a sheet over the bottom of the thread. The
// limits come from the published providers and can be edited here; the service
// drafts the permission, this phone checks the draft against them, and you
// sign with the hold seal.
export function ApproveSheet({
  taskId,
  input,
  onSigned,
  bottomInset = 0,
}: {
  bottomInset?: number;
  taskId: string;
  input: Record<string, unknown> | undefined;
  onSigned: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const [plan, setPlan] = useState<{
    form: TermsForm;
    providers: Provider[];
  } | null>(null);
  const [review, setReview] = useState<{
    draft: OwnerApproval;
    terms: Terms;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [holdKey, setHoldKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!input || plan) return;
    listProviders()
      .then((all) => {
        const p = defaultTerms(all, input);
        if (p)
          setPlan({
            ...p,
            form: {
              ...p.form,
              maxPayment: trim(p.form.maxPayment),
              spendCap: trim(p.form.spendCap),
              reviewThreshold: trim(p.form.reviewThreshold),
            },
          });
        else setError("No published provider can run these checks.");
      })
      .catch((e) => setError(errorText(e)));
  }, [input, plan]);

  const setMoney = (key: MoneyKey, value: string) => {
    setReview(null);
    setError(null);
    setPlan((p) => p && { ...p, form: { ...p.form, [key]: value } });
  };
  const check = async () => {
    if (inFlight.current || !plan) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const terms = taskTerms(plan.form, TOKENS[0]!.address!);
      const draft = await draftPermit(taskId, terms);
      const context = await permitContext(taskId, terms);
      setReview({ draft: validatePermitDraft(draft, context), terms });
      setEditing(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const approve = async () => {
    if (inFlight.current || !review) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const context = await permitContext(taskId, review.terms);
      const checked = validatePermitDraft(review.draft, context);
      await activatePermit(checked, taskId, review.terms);
      onSigned();
    } catch (e) {
      setError(errorText(e));
      setHoldKey((k) => k + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const f = plan?.form;
  const dusd = (v: string) => {
    try {
      return `${formatAmount(BigInt(decimalUnits(v)), 6)} DUSD`;
    } catch {
      return v;
    }
  };
  return (
    <View style={[styles.sheet, { paddingBottom: bottomInset + space.md }]}>
      <View style={styles.handle} />
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Approve spending
        </Text>
        {f && !busy ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditing((e) => !e)}
            hitSlop={10}
          >
            <Text style={styles.edit}>{editing ? "Done" : "Edit"}</Text>
          </Pressable>
        ) : null}
      </View>
      {!f ? (
        <Text style={styles.muted}>
          {error ?? "Looking up what this task can cost…"}
        </Text>
      ) : (
        <>
          {MONEY.map(([key, label]) =>
            editing ? (
              <View key={key} style={styles.field}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={f[key]}
                    onChangeText={(v) => setMoney(key, v)}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`${label} in DUSD`}
                    style={styles.input}
                  />
                  <Text style={styles.unit}>DUSD</Text>
                </View>
              </View>
            ) : (
              <CardLine key={key} label={label} value={dusd(f[key])} />
            ),
          )}
          <View style={open ? styles.more : styles.moreClosed}>
            {plan!.providers.map((p) => (
              <CardLine
                key={p.providerId}
                label={`Provider ${p.providerId.toUpperCase()}`}
                value={`${formatAmount(BigInt(p.price), 6)} DUSD a check`}
              />
            ))}
            <CardLine label="Keep in the wallet" value={dusd(f.liquidFloor)} />
            <CardLine label="Paid attempts" value={`Up to ${f.maxPayments}`} />
            {open ? null : (
              <View style={styles.fade} pointerEvents="none">
                {FADE.map((o) => (
                  <View
                    key={o}
                    style={[
                      styles.band,
                      { backgroundColor: colors.raised, opacity: o },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((o) => !o)}
            style={styles.seeMore}
            hitSlop={8}
          >
            <Text style={styles.seeMoreText}>
              {open ? "See less" : "See more"}
            </Text>
            <Icon
              name={open ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.ink2}
            />
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {review && !editing ? (
            <HoldToSeal
              key={holdKey}
              sealSize={72}
              label={busy ? "Approving…" : "Hold to approve"}
              disabled={busy}
              onSealed={approve}
            />
          ) : (
            <PrimaryButton
              label={busy ? "Checking…" : "Check and approve"}
              disabled={busy}
              onPress={check}
            />
          )}
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  sheet: {
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.outline,
    boxShadow: "0px -6px 24px rgba(20, 25, 28, 0.10)",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.rule,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...type.heading, color: colors.ink },
  edit: { ...type.bodyStrong, color: colors.primary },
  muted: { ...type.body, color: colors.ink2 },
  error: { ...type.body, color: colors.bad },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  fieldLabel: { ...type.body, color: colors.ink2, flex: 1 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minWidth: 130,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.ground,
  },
  input: {
    ...type.bodyStrong,
    flex: 1,
    minHeight: 40,
    textAlign: "right",
    color: colors.ink,
  },
  unit: { ...type.small, color: colors.ink3 },
  more: { gap: space.md },
  moreClosed: { gap: space.md, maxHeight: 62, overflow: "hidden" },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  band: { flex: 1 },
  seeMore: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: -space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.tile,
  },
  seeMoreText: { ...type.small, fontWeight: "600", color: colors.ink2 },
}));
