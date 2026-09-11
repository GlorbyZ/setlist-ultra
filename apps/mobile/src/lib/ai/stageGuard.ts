/** Live/stage mode: no AI apply/undo of the displayed chart while the Live tab is focused. */

let liveSessionActive = false;

export function setLiveSessionActive(active: boolean) {
  liveSessionActive = active;
}

export function isLiveSessionActive(): boolean {
  return liveSessionActive;
}

export function assertNotOnStage(action: string) {
  if (!liveSessionActive) return;
  throw new Error(`Cannot ${action} while Live is on stage. Leave Live first.`);
}
