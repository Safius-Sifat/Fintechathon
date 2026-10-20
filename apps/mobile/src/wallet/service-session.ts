import { hashCanonical } from "./service-validation";
// Generation tickets bind asynchronous login, requests and signatures to one unlock.
export class OwnerSessionGate {
  private owner: string | null = null;
  private generation = 0;
  update(owner: string | null) {
    const normalized = owner?.toLowerCase() ?? null;
    if (normalized !== this.owner) {
      this.owner = normalized;
      this.generation++;
    }
  }
  invalidate() {
    this.generation++;
  }
  ticket() {
    if (!this.owner) throw new Error("Unlock the wallet first.");
    return { owner: this.owner, generation: this.generation };
  }
  assert(ticket: { owner: string; generation: number }) {
    if (ticket.owner !== this.owner || ticket.generation !== this.generation)
      throw new Error(
        "The wallet was locked or the account changed. Try again.",
      );
  }
}
export function newOperationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function operationKey(
  pending: Readonly<Record<string, string>>,
  path: string,
  body: unknown,
) {
  const fingerprint = hashCanonical({ path, body });
  return { fingerprint, id: pending[fingerprint] ?? newOperationId() };
}
