// ─────────────────────────────────────────────────────────────────────────────
// Online status tracker — maps authenticated accounts to socket IDs
// ─────────────────────────────────────────────────────────────────────────────

export class OnlineTracker {
  /** accountId → socketId */
  private accountToSocket = new Map<string, string>();
  /** socketId → accountId */
  private socketToAccount = new Map<string, string>();

  /** Register an authenticated user as online */
  track(socketId: string, accountId: string): void {
    this.accountToSocket.set(accountId, socketId);
    this.socketToAccount.set(socketId, accountId);
  }

  /** Unregister by socketId; returns the accountId that was removed (if any) */
  untrack(socketId: string): string | undefined {
    const accountId = this.socketToAccount.get(socketId);
    if (accountId) {
      this.accountToSocket.delete(accountId);
      this.socketToAccount.delete(socketId);
    }
    return accountId;
  }

  /** Get the socketId for an online account (undefined if offline) */
  getSocketId(accountId: string): string | undefined {
    return this.accountToSocket.get(accountId);
  }

  isOnline(accountId: string): boolean {
    return this.accountToSocket.has(accountId);
  }

  /** Return all currently online accountIds */
  onlineIds(): string[] {
    return [...this.accountToSocket.keys()];
  }
}
