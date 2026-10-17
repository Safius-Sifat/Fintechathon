export type ClientOptions = { baseUrl: string; token: string };
export class MandateClient {
  constructor(private readonly options: ClientOptions) {}
  async getWallet(walletId: string): Promise<unknown> {
    return this.request(`/wallets/${encodeURIComponent(walletId)}`);
  }
  async getTask(taskId: string): Promise<unknown> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`);
  }
  private async request(path: string): Promise<unknown> {
    const response = await fetch(
      this.options.baseUrl.replace(/\/$/, "") + "/v1" + path,
      { headers: { Authorization: `Bearer ${this.options.token}` } },
    );
    if (!response.ok)
      throw new Error(`Mandate API returned ${response.status}`);
    return response.json();
  }
}
// Read client foundation only; mutations/evidence and response schemas remain Person4 tasks.
