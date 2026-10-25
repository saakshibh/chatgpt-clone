import cron from "node-cron";
import { randomUUID } from "crypto";
import Schedule from "../models/Schedule.js";
import Thread from "../models/Thread.js";
import { getSettings } from "../models/Settings.js";
import { runPrompt, buildSystemInstruction } from "./gemini.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Current date / HH:MM / weekday in a given timezone
function nowIn(timeZone) {
  const fmt = (tz) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(new Date());

  let parts;
  try {
    parts = fmt(timeZone);
  } catch {
    parts = fmt("Asia/Kolkata");
  }
  const get = (t) => parts.find((p) => p.type === t).value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
    dow: DAY_NAMES.indexOf(get("weekday")),
  };
}

// Runs one schedule: asks Gemini, saves the result and a chat you can open
export async function runSchedule(s) {
  let text = "";
  let ok = true;
  try {
    const settings = await getSettings(s.userId);
    text = await runPrompt(s.prompt, {
      webSearch: s.webSearch,
      systemInstruction: buildSystemInstruction(settings),
    });
    if (!text) throw new Error("Empty reply");
  } catch (e) {
    ok = false;
    text = `Run failed: ${e.message}`;
    console.error("SCHEDULE ERROR:", s.name, e.message);
  }

  let threadId = null;
  if (ok) {
    threadId = randomUUID();
    await Thread.create({
      userId: s.userId,
      threadId,
      title: `⏰ ${s.name}`.slice(0, 60),
      messages: [
        { role: "user", content: s.prompt },
        { role: "model", content: text },
      ],
    });
  }

  const run = { ranAt: new Date(), ok, text: text.slice(0, 20000), threadId };
  await Schedule.updateOne(
    { _id: s._id },
    { $push: { runs: { $each: [run], $position: 0, $slice: 10 } } }
  );
  return run;
}

// Checks every minute which schedules are due
export function startScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      const all = await Schedule.find({ enabled: true, userId: { $exists: true } });
      for (const s of all) {
        const now = nowIn(s.timezone);
        if (now.time !== s.time) continue;
        if (s.frequency === "weekly" && now.dow !== s.dayOfWeek) continue;

        const key = `${now.date} ${now.time}`;
        if (s.lastRunKey === key) continue; // already ran this minute

        await Schedule.updateOne({ _id: s._id }, { lastRunKey: key });
        runSchedule(s).catch((e) => console.error("SCHEDULE RUN ERROR:", e.message));
      }
    } catch (e) {
      console.error("SCHEDULER TICK ERROR:", e.message);
    }
  });
  console.log("Scheduler started");
}