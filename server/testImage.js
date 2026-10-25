import "dotenv/config";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

try {
  const r = await ai.models.generateContent({
    model,
    contents: "A flat illustration of a hackathon team coding at night",
  });
  const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) {
    console.log("No image returned. Text was:", r.text);
  } else {
    fs.writeFileSync("test.png", Buffer.from(part.inlineData.data, "base64"));
    console.log("OK: saved test.png using", model);
  }
} catch (e) {
  console.log("STATUS:", e.status);
  console.log("MESSAGE:", e.message);
}