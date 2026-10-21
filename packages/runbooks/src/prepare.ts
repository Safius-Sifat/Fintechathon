import {
  type Conditions,
  type Scope,
  type RunbookManifest,
  RUNBOOK_IDS,
} from "@mandate/schema";
import { type Hex, type Address } from "viem";
import {
  BrowserInputSchema,
  CommerceInputSchema,
  LiquidityInputSchema,
  ScheduleInputSchema,
} from "./validators.js";

export type RunbookId = (typeof RUNBOOK_IDS)[number];

export type PrepareTaskParams = {
  runbookId: RunbookId;
  goal?: string;
  input: Record<string, unknown>;
};

export type PrepareTaskResult = {
  conditions: Conditions | null;
  scope: Scope | null;
  runbookManifest: RunbookManifest;
  needsOwnerReason: string | null;
};

// Replaced by the trusted manifest's shop address when a task is created.
const DEFAULT_SHOP_BINDING = {
  providerId: "shop" as const,
  recipient: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Address,
};

const DEFAULT_PROVIDER_BINDINGS = [
  {
    providerId: "a" as const,
    recipient: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address,
  },
  {
    providerId: "b" as const,
    recipient: "0x6666666666666666666666666666666666666666" as Address,
  },
];

// Runbook artifact hashes are not built yet (P4-03: canonical hashes of the
// emitted JS, schemas, validator and lock file). Until they are, the manifest
// carries this marker and every prepared task says it cannot be approved,
// because an owner's Permit would not bind real code.
export const UNBUILT_ARTIFACT_HASH: Hex =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
export const UNBUILT_REASON =
  "Runbook artifact hashes are not built, so this task cannot be approved yet";

const KIND: Record<RunbookId, number> = {
  "browser-check": 0,
  "liquidity-keeper": 1,
  "scheduled-pay": 2,
  "service-allowance": 3,
  "commerce-buy": 0,
};

export function createRunbookManifest(
  runbookId: RunbookId,
  version = "1.0.0",
): RunbookManifest {
  return {
    schemaVersion: 4,
    runbookId,
    kind: KIND[runbookId],
    version,
    entryArtifactHash: UNBUILT_ARTIFACT_HASH,
    inputSchemaHash: UNBUILT_ARTIFACT_HASH,
    outputSchemaHash: UNBUILT_ARTIFACT_HASH,
    validatorArtifactHash: UNBUILT_ARTIFACT_HASH,
    dependencyLockHash: UNBUILT_ARTIFACT_HASH,
  };
}

export function prepareTask(params: PrepareTaskParams): PrepareTaskResult {
  const { runbookId, input } = params;
  const manifest = createRunbookManifest(runbookId);

  if (runbookId === "browser-check") {
    const parsed = BrowserInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        conditions: null,
        scope: null,
        runbookManifest: manifest,
        needsOwnerReason: `Invalid browser-check input: ${parsed.error.message}`,
      };
    }

    const { targetId, checks, maxPaidAttempts, maxSteps, taskDeadline } =
      parsed.data;
    const needsForm = checks.includes("formSubmit");
    const providerIds = needsForm ? (["b"] as const) : (["a", "b"] as const);

    const conditions: Conditions = {
      schemaVersion: 4,
      runbookId: "browser-check",
      browser: {
        targetId,
        checks,
        providerIds: [...providerIds],
        maxPaidAttempts,
        maxSteps,
        taskDeadline,
        resultMaxAgeSeconds: 300,
      },
      liquidity: null,
      schedule: null,
      allowance: null,
      calls: null,
    };

    const scope: Scope = {
      conditions,
      runbookManifest: manifest,
      providerBindings: DEFAULT_PROVIDER_BINDINGS.filter((p) =>
        providerIds.includes(p.providerId as any),
      ),
    };

    return {
      conditions,
      scope,
      runbookManifest: manifest,
      needsOwnerReason: UNBUILT_REASON,
    };
  }

  if (runbookId === "liquidity-keeper") {
    const parsed = LiquidityInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        conditions: null,
        scope: null,
        runbookManifest: manifest,
        needsOwnerReason: `Invalid liquidity input: ${parsed.error.message}`,
      };
    }

    const conditions: Conditions = {
      schemaVersion: 4,
      runbookId: "liquidity-keeper",
      browser: null,
      liquidity: {
        vault: parsed.data.vault as Address,
        command: parsed.data.command,
        amountUnits: parsed.data.amountUnits,
        maxSlippageBps: 50,
        riskSourceId: "demo-risk-v1",
        signalMaxAgeSeconds: 60,
      },
      schedule: null,
      allowance: null,
      calls: null,
    };

    const scope: Scope = {
      conditions,
      runbookManifest: manifest,
      providerBindings: [],
    };

    return {
      conditions,
      scope,
      runbookManifest: manifest,
      needsOwnerReason: UNBUILT_REASON,
    };
  }

  if (runbookId === "scheduled-pay") {
    const parsed = ScheduleInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        conditions: null,
        scope: null,
        runbookManifest: manifest,
        needsOwnerReason: `Invalid schedule input: ${parsed.error.message}`,
      };
    }

    const conditions: Conditions = {
      schemaVersion: 4,
      runbookId: "scheduled-pay",
      browser: null,
      liquidity: null,
      schedule: {
        recipient: parsed.data.recipient as Address,
        amount: parsed.data.amount,
        start: parsed.data.start,
        interval: parsed.data.interval,
        window: parsed.data.window,
        periods: parsed.data.periods,
      },
      allowance: null,
      calls: null,
    };

    const scope: Scope = {
      conditions,
      runbookManifest: manifest,
      providerBindings: [],
    };

    return {
      conditions,
      scope,
      runbookManifest: manifest,
      needsOwnerReason: UNBUILT_REASON,
    };
  }

  if (runbookId === "commerce-buy") {
    const parsed = CommerceInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        conditions: null,
        scope: null,
        runbookManifest: manifest,
        needsOwnerReason: `Invalid commerce-buy input: ${parsed.error.message}`,
      };
    }
    const conditions: Conditions = {
      schemaVersion: 4,
      runbookId: "commerce-buy",
      browser: null,
      liquidity: null,
      schedule: null,
      allowance: null,
      calls: null,
      commerce: {
        providerId: "shop",
        productId: parsed.data.productId,
        size: parsed.data.size,
        maxAmount: parsed.data.maxAmount,
        deliveryHash: parsed.data.deliveryHash as Hex,
        taskDeadline: parsed.data.taskDeadline,
      },
    };
    const scope: Scope = {
      conditions,
      runbookManifest: manifest,
      providerBindings: [DEFAULT_SHOP_BINDING],
    };
    return {
      conditions,
      scope,
      runbookManifest: manifest,
      needsOwnerReason: UNBUILT_REASON,
    };
  }

  return {
    conditions: null,
    scope: null,
    runbookManifest: manifest,
    needsOwnerReason: `Unsupported runbookId: ${runbookId}`,
  };
}
