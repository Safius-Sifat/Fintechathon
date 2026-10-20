import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAX_ALLOWANCE_SECONDS,
  MAX_POLICY_LIST,
  MAX_POLICY_TEMPLATES,
} from "@mandate/schema";
import { CEILINGS } from "../src/config/agentLimits";
import { formatAgentAmount, parseAgentAmount } from "../src/domain/amounts";
import {
  EMPTY_POLICY_FORM,
  allowlistState,
  capSummary,
  allowlistTurnsOff,
  clearAllPolicyForms,
  formFromSnapshot,
  getPolicyEditor,
  loadPolicyForm,
  policyChanges,
  setRecipientChoice,
  stoppedAuthorizations,
  switchPolicyContext,
  updatePolicyCap,
  validatePolicyForm,
  type OutstandingAuthorization,
  type PolicyForm,
  type PolicySnapshot,
} from "../src/state/policyDraft";

const ACCOUNT_A = { accountId: "account-a", chainId: 84532 };
const ACCOUNT_B = { accountId: "account-b", chainId: 84532 };

afterEach(() => clearAllPolicyForms());

const CURRENT: PolicySnapshot = {
  caps: {
    DemoUSD: { perTx: 500_000n, daily: 10_000_000n, weekly: 25_000_000n },
    USDC: { perTx: 500_000n, daily: 5_000_000n, weekly: 20_000_000n },
  },
  allowlist: ["a", "b"],
  blocklist: [],
  reviewThreshold: 300_000n,
};

function form(patch: (f: PolicyForm) => PolicyForm): PolicyForm {
  return patch(formFromSnapshot(CURRENT));
}

test("UI-08 policy form: S2 ceilings match Person1's contract constants", () => {
  const sol = readFileSync(
    fileURLToPath(
      new URL(
        "../../../packages/contracts/src/lib/MandateLimits.sol",
        import.meta.url,
      ).href,
    ),
    "utf8",
  );
  const constant = (name: string) => {
    const match = new RegExp(`constant ${name} = ([0-9_]+);`).exec(sol);
    assert.ok(match, name);
    return BigInt(match[1]!.replaceAll("_", ""));
  };
  assert.equal(CEILINGS.perPayment, constant("MAX_PAYMENT"));
  assert.equal(CEILINGS.taskSpend, constant("MAX_TASK_SPEND"));
  assert.equal(CEILINGS.walletDay, constant("MAX_WALLET_DAY"));
  assert.equal(CEILINGS.walletWeek, constant("MAX_WALLET_WEEK"));
  assert.equal(CEILINGS.liquidFloor, constant("MIN_LIQUID_FLOOR"));
  assert.equal(
    BigInt(CEILINGS.allowanceActions),
    constant("MAX_ALLOWANCE_ACTIONS"),
  );
  assert.equal(CEILINGS.policyList, MAX_POLICY_LIST);
  assert.equal(CEILINGS.policyTemplates, MAX_POLICY_TEMPLATES);
  assert.equal(BigInt(CEILINGS.allowanceDays * 86400), MAX_ALLOWANCE_SECONDS);
});

test("UI-08 policy form: agent amounts parse exactly to six-decimal base units", () => {
  assert.equal(parseAgentAmount("0.5"), 500_000n);
  assert.equal(parseAgentAmount(" 10 "), 10_000_000n);
  assert.equal(parseAgentAmount("0.000001"), 1n);
  assert.equal(parseAgentAmount("25.000000"), 25_000_000n);
  for (const bad of ["", " ", "0.0000001", "-1", "1e3", "1,5", "1.2.3", "."])
    assert.equal(parseAgentAmount(bad), null, JSON.stringify(bad));
  assert.equal(formatAgentAmount(500_000n), "0.50");
  assert.equal(formatAgentAmount(25_000_000n), "25.00");
  assert.equal(formatAgentAmount(1_234_567n), "1.234567");
});

test("UI-08 policy form: a cap above the S2 ceiling is rejected by the form", () => {
  const above = form((f) => ({
    ...f,
    caps: {
      ...f.caps,
      DemoUSD: { enabled: true, perTx: "0.51", daily: "10.01", weekly: "26" },
    },
  }));
  const check = validatePolicyForm(above);
  assert.equal(check.complete, false);
  assert.match(check.fieldErrors["DemoUSD.perTx"] ?? "", /0\.50/);
  assert.match(check.fieldErrors["DemoUSD.daily"] ?? "", /10\.00/);
  assert.match(check.fieldErrors["DemoUSD.weekly"] ?? "", /25\.00/);
  assert.equal(check.snapshot, null);

  const atCeiling = validatePolicyForm(formFromSnapshot(CURRENT));
  assert.equal(atCeiling.complete, true);
  assert.deepEqual(atCeiling.snapshot, CURRENT);
});

test("UI-08 policy form: per payment, per day and per week must be in order", () => {
  const check = validatePolicyForm(
    form((f) => ({
      ...f,
      caps: {
        ...f.caps,
        USDC: { enabled: true, perTx: "0.4", daily: "0.3", weekly: "0.2" },
      },
    })),
  );
  assert.equal(check.complete, false);
  assert.ok(check.fieldErrors["USDC.daily"], "daily below per payment");
  assert.ok(check.fieldErrors["USDC.weekly"], "weekly below daily");
});

test("UI-08 policy form: at least one asset needs limits, and a disabled asset needs none", () => {
  const none = validatePolicyForm(
    form((f) => ({
      ...f,
      caps: {
        DemoUSD: { ...f.caps.DemoUSD, enabled: false },
        USDC: { ...f.caps.USDC, enabled: false },
      },
    })),
  );
  assert.equal(none.complete, false);
  assert.ok(none.missing.length > 0);

  const usdcOff = validatePolicyForm(
    form((f) => ({
      ...f,
      caps: {
        ...f.caps,
        USDC: { enabled: false, perTx: "", daily: "", weekly: "" },
      },
    })),
  );
  assert.equal(usdcOff.complete, true);
  assert.equal(usdcOff.snapshot?.caps.USDC, undefined);
});

test("UI-08 policy form: the empty form starts with nothing chosen and is not complete", () => {
  const check = validatePolicyForm(EMPTY_POLICY_FORM);
  assert.equal(check.complete, false);
  assert.deepEqual(check.fieldErrors, {});
  assert.equal(EMPTY_POLICY_FORM.caps.USDC.enabled, false);
  assert.equal(EMPTY_POLICY_FORM.recipients.a, "none");
  assert.equal(EMPTY_POLICY_FORM.recipients.b, "none");
});

test("UI-08 policy form: removing the last allowed recipient turns filtering off and is flagged", () => {
  const oneLeft = form((f) => ({
    ...f,
    recipients: { a: "allowed", b: "none" },
  }));
  const noneLeft = form((f) => ({
    ...f,
    recipients: { a: "none", b: "none" },
  }));
  assert.equal(allowlistState(oneLeft), "on");
  assert.equal(allowlistState(noneLeft), "off");
  assert.equal(allowlistTurnsOff(CURRENT, oneLeft), false);
  assert.equal(allowlistTurnsOff(CURRENT, noneLeft), true);
  assert.equal(
    allowlistTurnsOff({ ...CURRENT, allowlist: [] }, noneLeft),
    false,
    "already off",
  );
  assert.equal(allowlistTurnsOff(null, noneLeft), false, "current unknown");

  const snapshot = validatePolicyForm(noneLeft).snapshot;
  assert.ok(snapshot);
  const off = policyChanges(CURRENT, snapshot).find((c) =>
    /allowlist off/i.test(c.text),
  );
  assert.ok(off, "change list names the allowlist turning off");
  assert.equal(off.tightens, false);
});

test("UI-08 policy form: a recipient is never both allowed and blocked", () => {
  setRecipientChoice(ACCOUNT_A, "a", "allowed");
  setRecipientChoice(ACCOUNT_A, "a", "blocked");
  const snapshot = validatePolicyForm({
    ...getPolicyEditor(ACCOUNT_A).form,
    caps: formFromSnapshot(CURRENT).caps,
  }).snapshot;
  assert.ok(snapshot);
  assert.deepEqual(snapshot.allowlist, []);
  assert.deepEqual(snapshot.blocklist, ["a"]);
});

test("UI-08 policy form: changes say whether they tighten or loosen", () => {
  const next: PolicySnapshot = {
    ...CURRENT,
    caps: {
      DemoUSD: { ...CURRENT.caps.DemoUSD!, perTx: 200_000n },
      USDC: CURRENT.caps.USDC,
    },
    blocklist: ["b"],
    allowlist: ["a"],
    reviewThreshold: null,
  };
  const changes = policyChanges(CURRENT, next);
  const find = (re: RegExp) => changes.find((c) => re.test(c.text));
  assert.equal(find(/DemoUSD.*per payment.*0\.50.*0\.20/i)?.tightens, true);
  assert.equal(find(/block.*Provider B/i)?.tightens, true);
  assert.equal(find(/never wait|no payment waits/i)?.tightens, false);
  assert.deepEqual(policyChanges(CURRENT, CURRENT), []);
});

const AUTHS: readonly OutstandingAuthorization[] = [
  {
    id: "x1",
    recipient: "a",
    asset: "USDC",
    amount: 400_000n,
    ownerApproved: true,
  },
  {
    id: "x2",
    recipient: "b",
    asset: "USDC",
    amount: 200_000n,
    ownerApproved: false,
  },
];

test("UI-08 policy form: lists outstanding x402 payments a change would stop (S9.10)", () => {
  assert.deepEqual(stoppedAuthorizations(CURRENT, AUTHS), []);

  const lowerPerTx = stoppedAuthorizations(
    {
      ...CURRENT,
      caps: {
        ...CURRENT.caps,
        USDC: { ...CURRENT.caps.USDC!, perTx: 300_000n },
      },
    },
    AUTHS,
  );
  assert.deepEqual(
    lowerPerTx.map((s) => s.id),
    ["x1"],
  );

  const noUsdc = stoppedAuthorizations(
    { ...CURRENT, caps: { DemoUSD: CURRENT.caps.DemoUSD } },
    AUTHS,
  );
  assert.deepEqual(
    noUsdc.map((s) => s.id),
    ["x1", "x2"],
  );

  const blocked = stoppedAuthorizations(
    { ...CURRENT, blocklist: ["b"], allowlist: ["a"] },
    AUTHS,
  );
  assert.deepEqual(
    blocked.map((s) => s.id),
    ["x2"],
  );

  const removedFromList = stoppedAuthorizations(
    { ...CURRENT, allowlist: ["b"] },
    AUTHS,
  );
  assert.deepEqual(
    removedFromList.map((s) => s.id),
    ["x1"],
  );

  // An empty allowlist turns filtering off, so it stops nothing.
  assert.deepEqual(
    stoppedAuthorizations({ ...CURRENT, allowlist: [] }, AUTHS),
    [],
  );

  // A lower review threshold stops only payments the owner did not approve.
  const lowerThreshold = stoppedAuthorizations(
    { ...CURRENT, reviewThreshold: 100_000n },
    AUTHS,
  );
  assert.deepEqual(
    lowerThreshold.map((s) => s.id),
    ["x2"],
  );

  // Daily and weekly caps were charged at registration and are not rechecked.
  const lowerDaily = stoppedAuthorizations(
    {
      ...CURRENT,
      caps: {
        ...CURRENT.caps,
        USDC: { perTx: 100_000n, daily: 100_000n, weekly: 100_000n },
      },
    },
    [{ ...AUTHS[1]!, amount: 100_000n }],
  );
  assert.deepEqual(lowerDaily, []);

  for (const s of [...lowerPerTx, ...noUsdc, ...blocked, ...lowerThreshold])
    assert.ok(s.reasons.length > 0 && s.reasons.every((r) => r.trim()));
});

test("UI-08 policy form: drafts belong to one account and network", () => {
  updatePolicyCap(ACCOUNT_A, "DemoUSD", { perTx: "0.2" });
  loadPolicyForm(ACCOUNT_B, formFromSnapshot(CURRENT), CURRENT);
  assert.equal(getPolicyEditor(ACCOUNT_A).form.caps.DemoUSD.perTx, "0.2");
  assert.equal(getPolicyEditor(ACCOUNT_A).baseline, null);
  assert.deepEqual(getPolicyEditor(ACCOUNT_B).baseline, CURRENT);
  switchPolicyContext(ACCOUNT_A, ACCOUNT_B);
  assert.deepEqual(getPolicyEditor(ACCOUNT_A).form, EMPTY_POLICY_FORM);
  assert.deepEqual(getPolicyEditor(ACCOUNT_B).baseline, CURRENT);
  clearAllPolicyForms();
  assert.equal(getPolicyEditor(ACCOUNT_B).baseline, null);
});

test("UI-08 policy form: an asset without a cap reads as agent spending disabled, never unlimited", () => {
  assert.equal(capSummary(undefined), "Agent spending disabled");
  assert.equal(capSummary(CURRENT.caps.DemoUSD), "0.50 · 10.00 · 25.00");
  const withoutUsdc: PolicySnapshot = {
    ...CURRENT,
    caps: { DemoUSD: CURRENT.caps.DemoUSD },
  };
  const texts = [
    ...policyChanges(CURRENT, withoutUsdc).map((c) => c.text),
    ...stoppedAuthorizations(withoutUsdc, AUTHS).flatMap((s) => s.reasons),
  ];
  assert.ok(texts.length > 0);
  for (const text of texts) {
    assert.doesNotMatch(text, /no .*limits|unlimited|no limit/i, text);
  }
  assert.ok(texts.some((t) => /disabled/i.test(t)));
});
