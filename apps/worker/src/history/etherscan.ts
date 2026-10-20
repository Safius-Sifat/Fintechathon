import { z } from "zod";

export const PAGE_SIZE = 1000;
export type IndexerAction = "txlist" | "tokentx" | "txlistinternal";

export class IndexerUnavailable extends Error {
  constructor(
    readonly reason:
      | "RATE_LIMIT"
      | "QUOTA"
      | "ERROR"
      | "MALFORMED"
      | "UNREACHABLE",
    detail: string,
  ) {
    super(`${reason}: ${detail.slice(0, 160)}`);
  }
}

const hex = z.string().regex(/^0x[0-9a-fA-F]*$/);
const digits = z.string().regex(/^[0-9]+$/);
const Item = z
  .object({
    blockNumber: digits,
    hash: hex,
    from: hex,
    to: z.string(),
    value: digits,
    contractAddress: z.string().optional(),
    logIndex: z.string().optional(),
    traceId: z.string().optional(),
    isError: z.string().optional(),
  })
  .passthrough();
export type IndexerItem = z.infer<typeof Item>;

// Etherscan V2 account endpoints for chain 84532. The API key is server-only.
export class EtherscanClient {
  constructor(
    readonly apiKey: string,
    readonly baseUrl = "https://api.etherscan.io/v2/api",
    readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async page(
    action: IndexerAction,
    address: string,
    fromBlock: bigint,
    toBlock: bigint,
    page: number,
  ): Promise<IndexerItem[]> {
    const url = new URL(this.baseUrl);
    for (const [k, v] of Object.entries({
      chainid: "84532",
      module: "account",
      action,
      address,
      startblock: fromBlock.toString(),
      endblock: toBlock.toString(),
      page: String(page),
      offset: String(PAGE_SIZE),
      sort: "asc",
      apikey: this.apiKey,
    }))
      url.searchParams.set(k, v);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new IndexerUnavailable(
        "UNREACHABLE",
        error instanceof Error ? error.message : "fetch failed",
      );
    }
    if (response.status === 429)
      throw new IndexerUnavailable("RATE_LIMIT", "HTTP 429");
    if (!response.ok)
      throw new IndexerUnavailable("ERROR", `HTTP ${response.status}`);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new IndexerUnavailable("MALFORMED", "response is not JSON");
    }
    const envelope = z
      .object({ status: z.string(), message: z.string(), result: z.unknown() })
      .safeParse(body);
    if (!envelope.success)
      throw new IndexerUnavailable("MALFORMED", "unexpected response envelope");
    const { status, message, result } = envelope.data;
    // Error envelopes carry status "0"; only the explicit empty result is an empty page.
    if (status === "0") {
      if (
        message === "No transactions found" &&
        Array.isArray(result) &&
        result.length === 0
      )
        return [];
      const text = typeof result === "string" ? result : message;
      if (/rate limit/i.test(text))
        throw new IndexerUnavailable("RATE_LIMIT", text);
      if (/quota|limit reached|plan/i.test(text))
        throw new IndexerUnavailable("QUOTA", text);
      throw new IndexerUnavailable("ERROR", text);
    }
    if (status !== "1" || !Array.isArray(result))
      throw new IndexerUnavailable("MALFORMED", "result is not a list");
    const items = z.array(Item).safeParse(result);
    if (!items.success)
      throw new IndexerUnavailable(
        "MALFORMED",
        "result items do not match the account schema",
      );
    return items.data;
  }
}
