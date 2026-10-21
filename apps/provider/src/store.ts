import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DeliveryEnvelope, QuoteEnvelope } from "@mandate/schema";

// Durable provider records: every invoice issued and, once paid, its single
// fulfillment. One JSON file per invoice, written atomically.
export interface InvoiceRecord {
  quote: QuoteEnvelope;
  targetId: "checkout-healthy" | "checkout-broken";
  checks: ("pageLoad" | "title" | "formSubmit")[];
  delivery: DeliveryEnvelope | null;
  // x402 only: the facilitator's settlement transaction, kept so a retry
  // checks it instead of settling a second time.
  settlementTxHash?: `0x${string}` | null;
}

export class InvoiceStore {
  constructor(private readonly dir: string) {}

  private path(invoiceId: string) {
    if (!/^0x[0-9a-f]{64}$/i.test(invoiceId)) throw new Error("Bad invoice ID");
    return join(this.dir, `${invoiceId.toLowerCase()}.json`);
  }

  async get(invoiceId: string): Promise<InvoiceRecord | null> {
    try {
      return JSON.parse(
        await readFile(this.path(invoiceId), "utf8"),
      ) as InvoiceRecord;
    } catch {
      return null;
    }
  }

  async put(record: InvoiceRecord): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const path = this.path(record.quote.invoice.invoiceId);
    await writeFile(`${path}.tmp`, JSON.stringify(record));
    await rename(`${path}.tmp`, path);
  }
}
