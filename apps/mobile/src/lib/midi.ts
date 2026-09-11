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

/** Program change + Note On, then Note Off (send Note Off after a short delay). */
export function midiOnLoadFrames(midi: MidiOnLoad): { immediate: number[][]; noteOff: number[] | null } {
  const channel = midi.channel - 1;
  const immediate: number[][] = [];
  if (midi.program != null) immediate.push([0xc0 | channel, midi.program]);
  if (midi.note != null) immediate.push([0x90 | channel, midi.note, 100]);
  const noteOff = midi.note != null ? [0x80 | channel, midi.note, 0] : null;
  return { immediate, noteOff };
}

/** Web MIDI only. Android/iOS have a navigator object but not requestMIDIAccess. */
export function midiOutputsAvailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess === 'function';
}

export async function sendMidiOnLoad(payload: string | null | undefined) {
  const parsed = parseMidiOnLoad(payload);
  if (!parsed || !midiOutputsAvailable()) return;
  try {
    const access = await (navigator as Navigator & { requestMIDIAccess: () => Promise<MIDIAccess> }).requestMIDIAccess();
    const outputs = [...access.outputs.values()];
    const out = outputs[0];
    if (!out) return;
    const { immediate, noteOff } = midiOnLoadFrames(parsed);
    for (const frame of immediate) out.send(frame);
    if (noteOff) {
      setTimeout(() => {
        try {
          out.send(noteOff);
        } catch {
          // Port may have closed.
        }
      }, 120);
    }
  } catch {
    // MIDI is optional; ignore missing Web MIDI / no output ports.
  }
}

type MIDIAccess = {
  outputs: Map<string, { send: (data: number[]) => void }>;
};
