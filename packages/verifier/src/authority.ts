import {
  hashDigest,
  PermitSchema,
  walletDomain,
  type EvidenceBundle,
  type Finding,
} from "@mandate/schema";
import { recoverAddress, type Hex } from "viem";
import type { VerifyContext } from "./context.js";

const finding = (
  state: Finding["state"],
  ruleId: string,
  reason: string,
  evidenceIds: string[],
  basis: Finding["basis"],
): Finding => ({
  name: "authority",
  state,
  ruleId,
  reason,
  evidenceIds,
  basis,
});

// Recovers who signed the task permit and compares it with the wallet's
// owner read from the chain. MPC execution itself is not provable here.
export async function checkAuthority(
  bundle: EvidenceBundle,
  ctx: VerifyContext,
): Promise<Finding> {
  const ids = bundle.events.map((e) => e.eventId);
  const a = bundle.authority as { permit?: unknown; owner_signature?: string };
  if (!a.permit || !a.owner_signature)
    return finding(
      "UNVERIFIABLE",
      "AUTHORITY_MISSING_DATA",
      "The bundle has no signed permit",
      ids,
      ["recorder_assertion"],
    );
  const permit = PermitSchema.safeParse(a.permit);
  if (!permit.success)
    return finding(
      "FAIL",
      "AUTHORITY_INVALID_PERMIT",
      `The permit is malformed: ${permit.error.message}`,
      ids,
      ["artifact"],
    );
  if (
    permit.data.taskId.toLowerCase() !==
    bundle.manifest.chainTaskId.toLowerCase()
  )
    return finding(
      "FAIL",
      "AUTHORITY_WRONG_TASK",
      "The permit is for another task",
      ids,
      ["signature"],
    );
  let signer: string;
  try {
    signer = await recoverAddress({
      hash: hashDigest(
        "Permit",
        permit.data,
        walletDomain(bundle.manifest.wallet),
      ),
      signature: a.owner_signature as Hex,
    });
  } catch {
    return finding(
      "FAIL",
      "AUTHORITY_BAD_SIGNATURE",
      "The permit signature cannot be recovered",
      ids,
      ["signature"],
    );
  }
  if (!ctx.chain?.walletOwner)
    return finding(
      "UNVERIFIABLE",
      "AUTHORITY_OWNER_NOT_READ",
      `The permit is signed by ${signer}; the wallet owner was not read from the chain`,
      ids,
      ["signature"],
    );
  if (signer.toLowerCase() !== ctx.chain.walletOwner.toLowerCase())
    return finding(
      "FAIL",
      "AUTHORITY_NOT_OWNER",
      `The permit is signed by ${signer}, not the wallet owner`,
      ids,
      ["signature", "chain"],
    );
  return finding(
    "PASS",
    "AUTHORITY_OWNER_SIGNED",
    "The wallet owner on the chain signed this task's permit. Whether the MPC nodes ran is a recorder assertion",
    ids,
    ["signature", "chain"],
  );
}
