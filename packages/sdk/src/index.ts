import {
  type AgentAnswer,
  type AgentQuestion,
  type WalletView,
  AgentAnswerSchema,
  AgentQuestionSchema,
  WalletViewSchema,
} from "@mandate/schema";

export type ClientOptions = {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
};

export type CreateTaskParams = {
  walletId: string;
  runbookId: string;
  goal: string;
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

  // POST /v1/tasks. The same idempotency key must be reused on a retry.
  async createTask(
    params: CreateTaskParams,
    idempotencyKey: string,
  ): Promise<PrepareTaskResponse> {
    return this.request("/tasks", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(params),
    });
  }

  // Long-polls for the next question the runbook asks the agent. null when
  // there is none.
  async nextQuestion(taskId: string): Promise<AgentQuestion | null> {
    const data = await this.request(
      `/tasks/${encodeURIComponent(taskId)}/questions/next`,
    );
    return data === null ? null : AgentQuestionSchema.parse(data);
  }

  async answerQuestion(
    questionId: string,
    answer: AgentAnswer,
  ): Promise<{ accepted: true; decisionId: string }> {
    return this.request(`/questions/${encodeURIComponent(questionId)}/answer`, {
      method: "POST",
      body: JSON.stringify(AgentAnswerSchema.parse(answer)),
    });
  }

  async runTask(
    taskId: string,
    idempotencyKey?: string,
  ): Promise<{ status: string; taskId: string }> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return this.request(`/tasks/${encodeURIComponent(taskId)}/run`, {
      method: "POST",
      headers,
    });
  }

  // The evidence export is a ZIP; check it with mandate-verify.
  async getEvidence(taskId: string): Promise<Uint8Array> {
    const res = await this.fetchFn(
      `${this.baseUrl}/v1/tasks/${encodeURIComponent(taskId)}/evidence`,
      { headers: { Authorization: `Bearer ${this.token}` } },
    );
    if (!res.ok) throw new Error(`Mandate API request failed (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
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
