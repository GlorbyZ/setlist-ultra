import { AiError, classifyThrown, redactSecrets } from './errors';

export type DeadlineHandle = {
  signal: AbortSignal;
  dispose: () => void;
};

/** Combine a caller abort signal with an overall deadline. */
export function withDeadline(parent: AbortSignal | undefined, deadlineMs: number): DeadlineHandle {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (parent) {
    if (parent.aborted) {
      controller.abort();
    } else {
      parent.addEventListener('abort', onAbort, { once: true });
    }
  }
  const timer = setTimeout(() => {
    controller.abort();
  }, Math.max(1, deadlineMs));

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  options?: { timeoutMessage?: string },
): Promise<{ status: number; json: T }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (error) {
    const classified = classifyThrown(error);
    if (classified.code === 'cancelled') {
      const parentAborted = init.signal?.aborted;
      throw new AiError(parentAborted ? 'cancelled' : 'timeout', parentAborted ? 'Request cancelled.' : options?.timeoutMessage || 'Request timed out.');
    }
    throw classified;
  }

  let json: T;
  try {
    json = (await res.json()) as T;
  } catch {
    throw new AiError(res.ok ? 'unknown' : classifyThrown(new Error(`HTTP ${res.status}`), res.status).code, `Provider returned a non-JSON response (${res.status}).`, {
      status: res.status,
    });
  }

  return { status: res.status, json };
}

export function assertNoKeyInUrl(url: string) {
  if (/[?&]key=/i.test(url) || /AIza/.test(url)) {
    throw new AiError('unknown', 'Provider URL must not include credentials.');
  }
}

export function safeErrorMessage(status: number, message?: string): string {
  return redactSecrets(message || `Request failed (${status})`);
}
