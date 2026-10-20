import {
  type WalletView,
  type EvidenceBundle,
  WalletViewSchema,
  EvidenceBundleSchema,
} from "@mandate/schema";

export type ClientOptions = {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
};

export type PrepareTaskParams = {
  runbookId: string;
  goal?: string;
  input: Record<string, unknown>;
};

export type PrepareTaskResponse = {
  taskId: string;
  chainTaskId: string;
  permitId: string;
  conditions: unknown;
  needsOwnerReview: boolean;
};

export class MandateClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  async getWallet(walletId: string): Promise<WalletView> {
    const data = await this.request(`/wallets/${encodeURIComponent(walletId)}`);
    return WalletViewSchema.parse(data);
  }

  async getTask(taskId: string): Promise<Record<string, unknown>> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`);
  }

  async prepareTask(params: PrepareTaskParams): Promise<PrepareTaskResponse> {
    return this.request("/tasks/prepare", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async runTask(taskId: string, idempotencyKey?: string): Promise<{ status: string; taskId: string }> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return this.request(`/tasks/${encodeURIComponent(taskId)}/run`, {
      method: "POST",
      headers,
    });
  }

  async getEvidence(taskId: string): Promise<EvidenceBundle> {
    const data = await this.request(`/tasks/${encodeURIComponent(taskId)}/evidence`);
    return EvidenceBundleSchema.parse(data);
  }

  private async request<T = any>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await this.fetchFn(`${this.baseUrl}/v1${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      let errorBody: any;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new Error(
        `Mandate API request failed (${res.status}): ${typeof errorBody === "object" ? JSON.stringify(errorBody) : errorBody}`,
      );
    }

    return res.json();
  }
}
