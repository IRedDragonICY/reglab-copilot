import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const list = ['gemini-3-flash-preview', 'gemini-3.0-flash', 'gemini-3.0-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview'];
    for(const m of list) {
      try {
        const r = await ai.models.generateContent({ model: m, contents: "hi" });
        console.log(m, "WORKS");
      } catch(e: any) {
        console.error(m, "ERR", e.message);
      }
    }
  } catch (e) {
    console.error(e);
  }
}
run();
