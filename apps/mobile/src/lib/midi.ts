export type MidiOnLoad = {
  channel: number;
  program?: number;
  note?: number;
};

export function parseMidiOnLoad(payload: string | null | undefined): MidiOnLoad | null {
  if (!payload?.trim()) return null;
  try {
    const parsed = JSON.parse(payload) as Partial<MidiOnLoad>;
    const channel = Number(parsed.channel);
    if (!Number.isFinite(channel) || channel < 1 || channel > 16) return null;
    const program = parsed.program == null ? undefined : Number(parsed.program);
    const note = parsed.note == null ? undefined : Number(parsed.note);
    if (program != null && (!Number.isFinite(program) || program < 0 || program > 127)) return null;
    if (note != null && (!Number.isFinite(note) || note < 0 || note > 127)) return null;
    if (program == null && note == null) return null;
    return { channel, program, note };
  } catch {
    return null;
  }
}

export function serializeMidiOnLoad(midi: MidiOnLoad): string {
  return JSON.stringify(midi);
}

export function midiOutputsAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
}

export async function sendMidiOnLoad(payload: string | null | undefined) {
  const parsed = parseMidiOnLoad(payload);
  if (!parsed || !midiOutputsAvailable()) return;
  try {
    const access = await (navigator as Navigator & { requestMIDIAccess: () => Promise<MIDIAccess> }).requestMIDIAccess();
    const outputs = [...access.outputs.values()];
    const out = outputs[0];
    if (!out) return;
    const channel = parsed.channel - 1;
    if (parsed.program != null) {
      out.send([0xc0 | channel, parsed.program]);
    }
    if (parsed.note != null) {
      out.send([0x90 | channel, parsed.note, 100]);
    }
  } catch {
    // MIDI is optional; ignore missing Web MIDI / no output ports.
  }
}

type MIDIAccess = {
  outputs: Map<string, { send: (data: number[]) => void }>;
};
