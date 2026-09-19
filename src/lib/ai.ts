import OpenAI from "openai";

export const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://thainhaidee.com", // URL เว็บคุณ
    "X-Title": "Thainhaidee Travel Planner",
  },
});

export async function generateTripHighlights(tripSummary: string) {
  const response = await openai.chat.completions.create({
    model: "google/gemini-2.0-flash-001", // แนะนำโมเดลนี้
    messages: [
      { role: "system", content: "คุณคือผู้ช่วยวางแผนเที่ยวไทยไหนดี แนะนำทริปให้น่าสนใจ สรุปกระชับ ภาษาเป็นกันเอง" },
      { role: "user", content: `ช่วยสรุปไฮไลท์และคำแนะนำสำหรับทริปนี้หน่อย: ${tripSummary}` },
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}
