import { Platform } from 'react-native';

export type PedalAction = 'next' | 'prev' | 'scrollDown' | 'scrollUp';

const KEY_MAP: Record<string, PedalAction> = {
  PageDown: 'next',
  PageUp: 'prev',
  ArrowRight: 'next',
  ArrowLeft: 'prev',
  ArrowDown: 'scrollDown',
  ArrowUp: 'scrollUp',
  ' ': 'scrollDown',
  Spacebar: 'scrollDown',
  b: 'prev',
  B: 'prev',
  n: 'next',
  N: 'next',
};

export function actionFromKey(key: string): PedalAction | null {
  return KEY_MAP[key] ?? null;
}

/** BLE stage pedals (AirTurn, etc.) usually appear as HID keyboards. */
export function subscribePedals(onAction: (action: PedalAction) => void): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    const action = actionFromKey(event.key);
    if (!action) return;
    event.preventDefault();
    onAction(action);
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
