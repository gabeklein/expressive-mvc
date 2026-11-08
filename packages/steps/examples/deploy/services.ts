export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

export const delay = (ms: number, { signal }: { signal: AbortSignal }) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

export const ci = {
  async build(version: string): Promise<string> {
    return `app-${version}.tgz`;
  },
  async test(artifact: string, { signal }: { signal: AbortSignal }): Promise<void> {
    void artifact;
    signal.throwIfAborted();
  }
};

export const git = {
  async tag(version: string): Promise<void> {
    void version;
  },
  async untag(version: string): Promise<void> {
    void version;
  }
};

export const registry = {
  async unpublish(artifact: string): Promise<void> {
    void artifact;
  },
  async remove(version: string): Promise<void> {
    void version;
  }
};

export const fleet = {
  async install(host: string, artifact: string): Promise<void> {
    void host;
    void artifact;
  },
  async uninstall(host: string): Promise<void> {
    void host;
  },
  drain(host: string) {
    void host;
  },
  serve(host: string) {
    void host;
  }
};

export const db = {
  async migrate(version: string): Promise<void> {
    void version;
  }
};

export const pager = {
  nudge(message: string) {
    void message;
  }
};

export const chat = {
  async post(message: string): Promise<void> {
    void message;
  }
};
