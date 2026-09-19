import OpenAI from "openai";

// OpenRouter speaks the OpenAI API. Server-only: the key must never reach the browser.

/** Model id on OpenRouter; override with OPENROUTER_MODEL without a code change. */
export const AI_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3.8-flash";

/** OpenAI model (via OpenRouter) that writes the per-route advice on the plan options. */
export const ROUTE_ADVICE_MODEL = process.env.OPENROUTER_ROUTE_MODEL || "openai/gpt-5.4-mini";

/**
 * OpenRouter's reasoning control (not part of the OpenAI types). Gemini 3.x can't turn
 * reasoning off; "low" keeps replies fast and cheap while still choosing tools sensibly.
 */
export const AI_REASONING = { reasoning: { effort: "low" } } as Record<string, unknown>;

let client: OpenAI | null = null;

export function isAiConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Created on first use so builds and pages without the key still work. */
export function getAi(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY.");
  client ??= new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "https://thainhaidee.vercel.app",
      "X-Title": "Thainhaidee Travel Planner",
    },
  });
  return client;
}

export async function generateTripHighlights(tripSummary: string) {
  const response = await getAi().chat.completions.create({
    model: AI_MODEL,
    messages: [
      {
        role: "system",
        content: "คุณคือผู้ช่วยวางแผนเที่ยวไทยไหนดี แนะนำทริปให้น่าสนใจ สรุปกระชับ ภาษาเป็นกันเอง",
      },
      { role: "user", content: `ช่วยสรุปไฮไลท์และคำแนะนำสำหรับทริปนี้หน่อย: ${tripSummary}` },
    ],
    temperature: 0.7,
    ...AI_REASONING,
  });

  return response.choices[0].message.content;
}
