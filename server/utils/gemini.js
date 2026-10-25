import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-flash-latest";

// Older messages are sent as text only (with a note if files were attached)
const toContents = (messages) =>
  messages.map((m) => {
    let text = m.content;
    if (m.attachments?.length) {
      text += `\n[Attached files: ${m.attachments.map((a) => a.name).join(", ")}]`;
    }
    return { role: m.role, parts: [{ text }] };
  });

// Turns the saved personalization into a system instruction
const CODEX_PROMPT =
  "You are Codex, a senior software engineer pair-programming with the user. " +
  "Briefly explain the approach first, then give complete, working code in fenced code blocks " +
  "with the language tag, then say how to run or test it. Point out bugs, edge cases and " +
  "time complexity when relevant. Ask a clarifying question only when it is truly necessary.";

// Turns the saved personalization (and the chat mode) into a system instruction
const VOICE_PROMPT =
  "The user is talking to you by voice and your reply will be read aloud. " +
  "Answer conversationally in at most 3 or 4 short sentences. Do not use markdown, " +
  "bullet points, tables or code blocks. If code is needed, say you can write it in the text chat.";

// Turns the saved personalization (and the chat mode) into a system instruction
export function buildSystemInstruction(s, mode = "chat", voice = false) {
  const parts = [];
  if (mode === "codex") parts.push(CODEX_PROMPT);
  if (voice) parts.push(VOICE_PROMPT);
  if (s && s.personalizationOn) {
    if (s.displayName) parts.push(`The user's name is ${s.displayName}.`);
    if (s.aboutYou) parts.push(`About the user:\n${s.aboutYou}`);
    if (s.customInstructions)
      parts.push(`How the user wants you to respond:\n${s.customInstructions}`);
  }
  return parts.length ? parts.join("\n\n") : undefined;
}

// messages = [{ role: "user" | "model", content: "..." }]
export async function getReply(messages) {
  const result = await ai.models.generateContent({
    model: MODEL,
    contents: toContents(messages),
  });
  return result.text;
}

// Yields the reply in pieces. Options: files (for the LAST message),
// webSearch (Google Search grounding), thinking (reasoning budget),
// systemInstruction (personalization).
export async function* streamReply(
  messages,
  { files = [], webSearch = false, thinking = false, systemInstruction } = {}
) {
  const contents = toContents(messages);
  if (files.length) {
    const last = contents[contents.length - 1];
    for (const f of files) {
      last.parts.push({
        inlineData: { mimeType: f.mimeType, data: f.buffer.toString("base64") },
      });
    }
  }

  const buildConfig = (useSearch, useThinking) => {
    const config = {};
    if (systemInstruction) config.systemInstruction = systemInstruction;
    if (useSearch) config.tools = [{ googleSearch: {} }];
    if (useThinking) config.thinkingConfig = { thinkingBudget: 8192 };
    return config;
  };

  let stream;
  try {
    stream = await ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: buildConfig(webSearch, thinking),
    });
  } catch (e) {
    if (!webSearch && !thinking) throw e;
    console.error("Extras rejected, retrying plain:", e.message);
    yield "_Web search or thinking is unavailable right now, so this answer was generated without it._\n\n";
    stream = await ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: buildConfig(false, false),
    });
  }

  const sources = new Map();
  for await (const chunk of stream) {
    const gm = chunk.candidates?.[0]?.groundingMetadata;
    gm?.groundingChunks?.forEach((c) => {
      if (c.web?.uri) sources.set(c.web.uri, c.web.title || c.web.uri);
    });
    if (chunk.text) yield chunk.text;
  }

  if (sources.size) {
    yield (
      "\n\n**Sources**\n" +
      [...sources].map(([uri, title]) => `- [${title}](${uri})`).join("\n")
    );
  }
}

// Short chat title from the first message (uses a lighter model)
export async function generateTitle(message) {
  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents:
      "Write a title of at most 5 words for a chat that starts with the message below. " +
      "Reply with only the title: no quotes, no punctuation at the end.\n\n" +
      message.slice(0, 500),
  });
  return (result.text || "")
    .trim()
    .replace(/^["'`]+|["'`.]+$/g, "")
    .slice(0, 60);
}
// One-shot, non-streaming answer (used by scheduled tasks)
export async function runPrompt(prompt, { webSearch = false, systemInstruction } = {}) {
  const config = {};
  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (webSearch) config.tools = [{ googleSearch: {} }];
  try {
    const r = await ai.models.generateContent({ model: MODEL, contents: prompt, config });
    return r.text || "";
  } catch (e) {
    if (!webSearch) throw e;
    console.error("Search rejected, retrying plain:", e.message);
    const plain = systemInstruction ? { systemInstruction } : {};
    const r = await ai.models.generateContent({ model: MODEL, contents: prompt, config: plain });
    return r.text || "";
  }
}