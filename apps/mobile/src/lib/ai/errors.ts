/** Classified AI errors — never include API keys or chart bodies. */

export type AiErrorCode =
  | 'invalid_key'
  | 'quota'
  | 'rate_limit'
  | 'unavailable_model'
  | 'safety'
  | 'truncated'
  | 'invalid_structure'
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'unknown';

const SECRET_RE = /(AIza[0-9A-Za-z_-]{10,}|sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,}|key=[^&\s]+)/gi;

export function redactSecrets(value: string): string {
  return value.replace(SECRET_RE, '[redacted]');
}

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;
  readonly rawText?: string;

  constructor(code: AiErrorCode, message: string, options?: { status?: number; rawText?: string; cause?: unknown }) {
    super(redactSecrets(message));
    this.name = 'AiError';
    this.code = code;
    this.status = options?.status;
    this.rawText = options?.rawText;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}

export function classifyHttpStatus(status: number): AiErrorCode | null {
  if (status === 401 || status === 403) return 'invalid_key';
  if (status === 404) return 'unavailable_model';
  if (status === 429) return 'rate_limit';
  if (status === 408 || status === 504) return 'timeout';
  return null;
}

export function classifyProviderMessage(message: string, status?: number): AiErrorCode {
  const fromStatus = status != null ? classifyHttpStatus(status) : null;
  const lower = redactSecrets(message).toLowerCase();

  if (fromStatus === 'invalid_key' || lower.includes('api key') || lower.includes('invalid key') || lower.includes('incorrect api')) {
    return 'invalid_key';
  }
  if (lower.includes('quota') || lower.includes('billing') || lower.includes('insufficient')) {
    return 'quota';
  }
  if (fromStatus === 'rate_limit' || lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'rate_limit';
  }
  if (
    fromStatus === 'unavailable_model' ||
    lower.includes('no longer available') ||
    lower.includes('not found') ||
    lower.includes('is not found') ||
    lower.includes('not supported') ||
    (lower.includes('model') && lower.includes('unavailable'))
  ) {
    return 'unavailable_model';
  }
  if (lower.includes('safety') || lower.includes('blocked') || lower.includes('recitation')) {
    return 'safety';
  }
  if (lower.includes('max tokens') || lower.includes('truncated') || lower.includes('length')) {
    return 'truncated';
  }
  if (fromStatus === 'timeout' || lower.includes('timeout') || lower.includes('timed out') || lower.includes('deadline')) {
    return 'timeout';
  }
  if (lower.includes('abort') || lower.includes('cancel')) {
    return 'cancelled';
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('offline')) {
    return 'network';
  }
  return fromStatus ?? 'unknown';
}

export function classifyThrown(error: unknown, status?: number): AiError {
  if (error instanceof AiError) return error;
  const name = error instanceof Error ? error.name : '';
  if (name === 'AbortError' || (error instanceof DOMException && error.name === 'AbortError')) {
    return new AiError('cancelled', 'Request cancelled.');
  }
  const message = error instanceof Error ? error.message : String(error);
  const code = classifyProviderMessage(message, status);
  return new AiError(code, message, { status, cause: error });
}

export function userFacingAssistError(error: unknown, hosted: boolean): string {
  if (hosted) {
    const classified = classifyThrown(error);
    if (classified.code === 'cancelled') return 'Cancelled.';
    if (classified.code === 'invalid_structure') {
      return classified.message || 'The assistant returned something we could not use. Your inputs are saved.';
    }
    return 'Assistant is temporarily busy.';
  }
  return userFacingAiError(error);
}

export function userFacingAiError(error: unknown): string {
  const classified = classifyThrown(error);
  switch (classified.code) {
    case 'invalid_key':
      return 'API key was rejected. Check the key for this provider in Assistant settings.';
    case 'quota':
      return 'Provider quota or billing limit reached.';
    case 'rate_limit':
      return 'Provider rate limit — wait and try again.';
    case 'unavailable_model':
      return 'That model is unavailable. Pick another model or allow fallback in chat.';
    case 'safety':
      return 'The provider refused this request for safety reasons.';
    case 'truncated':
      return 'The model ran out of output space before finishing. Narrow the request and retry.';
    case 'invalid_structure':
      return classified.message || 'The model returned output that did not pass validation.';
    case 'timeout':
      return 'The request timed out.';
    case 'cancelled':
      return 'Cancelled.';
    case 'network':
      return 'Network error — AI needs a connection. Charts stay available offline.';
    default:
      return classified.message || 'Request failed.';
  }
}
