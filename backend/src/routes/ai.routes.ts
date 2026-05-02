import { Router } from 'express';

const router = Router();

const SYSTEM_PROMPT = `You are the LocalDAO homepage assistant—friendly, concise, and accurate.

LocalDAO helps neighborhoods invest together: founders create DAOs on-chain (via a factory contract); admins verify members with KYC-style commitments; verified members propose and vote on local investments (USDC staking on upvotes); yield can be deposited and claimed per DAO rules.

You are not qualified to give personal financial or legal advice. Encourage users to verify on-chain facts in the app or block explorer.

If unsure, say you do not know. Keep answers short unless the user asks for detail. Plain language, no hype.`;

const MAX_MSG_LEN = 12_000;
const MAX_MESSAGES = 24;

type Role = 'user' | 'assistant';

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number };
}

function buildContents(messages: Array<{ role: Role; content: string }>) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content.slice(0, MAX_MSG_LEN) }],
  }));
}

router.post('/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: 'AI assistant is not configured (missing GEMINI_API_KEY).' });
  }

  const model = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  const raw = req.body?.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array.' });
  }

  const messages: Array<{ role: Role; content: string }> = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== 'object') continue;
    const role = item.role;
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    if (content.length === 0) continue;
    if (role !== 'user' && role !== 'assistant') continue;
    messages.push({ role, content });
  }

  if (messages.length === 0) {
    return res.status(400).json({ error: 'No valid user/assistant messages.' });
  }
  if (messages[messages.length - 1]!.role !== 'user') {
    return res.status(400).json({ error: 'Last message must be from the user.' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const googleRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: buildContents(messages),
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1024,
        },
      }),
    });

    const data = (await googleRes.json()) as GeminiGenerateResponse;

    if (!googleRes.ok) {
      const msg = data.error?.message || googleRes.statusText || 'Gemini API error';
      console.error('[ai/chat] Gemini error:', googleRes.status, msg);
      return res.status(502).json({ error: msg });
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    const trimmed = text.trim();
    if (!trimmed) {
      return res.status(502).json({
        error: 'Empty model response.',
        blocked: data.candidates?.[0]?.finishReason === 'SAFETY',
      });
    }

    return res.json({ reply: trimmed });
  } catch (e: unknown) {
    console.error('[ai/chat]', e);
    return res.status(500).json({ error: 'Failed to reach AI service.' });
  }
});

export default router;
