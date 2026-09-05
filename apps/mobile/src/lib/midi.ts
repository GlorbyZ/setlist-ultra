export async function sendMidiOnLoad(payload: string | null | undefined) {
  if (!payload || typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) return;
  try {
    const parsed = JSON.parse(payload) as { channel?: number; program?: number; note?: number };
    const access = await (navigator as Navigator & { requestMIDIAccess: () => Promise<MIDIAccess> }).requestMIDIAccess();
    const outputs = [...access.outputs.values()];
    const out = outputs[0];
    if (!out) return;
    const channel = (parsed.channel ?? 1) - 1;
    if (parsed.program != null) {
      out.send([0xc0 | channel, parsed.program]);
    }
    if (parsed.note != null) {
      out.send([0x90 | channel, parsed.note, 100]);
    }
  } catch {
    // MIDI is optional; ignore missing Web MIDI / malformed SBP payloads.
  }
}

type MIDIAccess = {
  outputs: Map<string, { send: (data: number[]) => void }>;
};
