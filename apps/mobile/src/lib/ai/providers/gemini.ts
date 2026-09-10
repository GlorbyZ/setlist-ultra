import type { AiChatClient, ChatCompletionRequest, ChatCompletionResult, ChatMessage } from '../types';

const DEFAULT_MODEL = 'gemini-2.0-flash';

function toGeminiContents(messages: ChatMessage[]) {
  const systemParts: string[] = [];
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
      continue;
    }
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += `\n\n${msg.content}`;
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  // Gemini requires the first turn to be a user message.
  if (contents.length && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '(continue)' }] });
  }

  return {
    systemInstruction: systemParts.length
      ? { parts: [{ text: systemParts.join('\n\n') }] }
      : undefined,
    contents,
  };
}

async function complete(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const model = req.model?.trim() || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(req.apiKey)}`;
  const body = toGeminiContents(req.messages);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      generationConfig: {
        temperature: req.temperature ?? 0.7,
      },
    }),
  });

  const json = (await res.json()) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `Gemini request failed (${res.status})`);
  }

  const text =
    json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim() ?? '';

  if (!text) throw new Error('Gemini returned an empty response.');

  return { text, model, provider: 'gemini' };
}

export const geminiClient: AiChatClient = {
  provider: 'gemini',
  complete,
};
