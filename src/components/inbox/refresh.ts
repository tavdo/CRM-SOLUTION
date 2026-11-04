/** Keep one refresh in flight; a burst during it requires just one follow-up. */
export function createRefreshGate(refresh: () => Promise<void>) {
  let running: Promise<void> | null = null;
  let pending = false;
  let disposed = false;
  return {
    request(): Promise<void> {
      if (disposed) return Promise.resolve();
      pending = true;
      if (!running) {
        running = (async () => {
          while (pending && !disposed) {
            pending = false;
            await refresh();
          }
        })().finally(() => { running = null; });
      }
      return running;
    },
    dispose() { disposed = true; pending = false; },
  };
}
