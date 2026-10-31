import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Words shown while the answer is being prepared, grouped by topic.
// Edit, add or remove lines freely.
const WORDS = {
  chat: [
    "Thinking",
    "Putting thoughts together",
    "Finding the right words",
    "Shaping a clear answer",
  ],
  coding: [
    "Writing code",
    "Structuring components",
    "Wiring up the logic",
    "Styling the layout",
    "Checking for bugs",
    "Polishing the syntax",
  ],
  pdf: [
    "Reading your request",
    "Gathering key points",
    "Organizing sections",
    "Formatting pages",
    "Building your PDF",
  ],
  ppt: [
    "Outlining the slides",
    "Picking the main points",
    "Designing the layout",
    "Choosing the visuals",
    "Building your presentation",
  ],
  vision: [
    "Looking at the image",
    "Spotting the details",
    "Reading what is inside",
    "Analyzing the picture",
  ],
  search: [
    "Searching the web",
    "Opening sources",
    "Comparing results",
    "Collecting the facts",
    "Putting it together",
  ],
};

// "auto" has no fixed topic, so guess it from what the user typed
const guessTopic = (prompt = "") => {
  const text = prompt.toLowerCase();
  if (/\b(pdf|document|report|resume|notes)\b/.test(text)) return "pdf";
  if (/\b(ppt|pptx|slides?|presentation|deck)\b/.test(text)) return "ppt";
  if (/\b(image|photo|picture|screenshot|diagram)\b/.test(text)) return "vision";
  if (
    /\b(code|function|component|navbar|html|css|react|javascript|python|bug|script|api|program)\b/.test(
      text,
    )
  )
    return "coding";
  if (/\b(search|latest|news|today|current|price|weather|who is)\b/.test(text))
    return "search";
  return "chat";
};

const resolveTopic = (agent, prompt) => {
  const key = String(agent || "").toLowerCase();
  return WORDS[key] ? key : guessTopic(prompt);
};

const WORD_INTERVAL_MS = 2200; // how long each word stays

// 7 -> "7s", 65 -> "1m 05s"
const formatTime = (totalSeconds) => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}m ${s}s`;
};

/**
 * Shows three bouncing dots and a rotating word while the AI reply is on its way.
 *
 * Props:
 *   agent  - "auto" | "chat" | "coding" | "pdf" | "ppt" | "vision" | "search"
 *   prompt - the user's message (only used to guess the topic for "auto")
 */
const Loading = ({ agent = "auto", prompt = "" }) => {
  const reduceMotion = useReducedMotion();
  const topic = resolveTopic(agent, prompt);
  const words = useMemo(() => WORDS[topic], [topic]);

  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // rotate the words
  useEffect(() => {
    setIndex(0);
    const id = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      WORD_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [words]);

  // count the seconds since the loader appeared
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full justify-start"
    >
      <div className="inline-flex max-w-[85%] rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
        <div className="flex items-center gap-3">
          {/* three dots going up and down */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block h-2 w-2 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500"
                animate={
                  reduceMotion
                    ? { opacity: [0.35, 1, 0.35] }
                    : { y: [0, -7, 0], opacity: [0.5, 1, 0.5] }
                }
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>

          {/* word related to the topic */}
          <div className="relative h-5 min-w-[9rem] overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={`${topic}-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 whitespace-nowrap text-[13px] leading-5 text-slate-400"
              >
                {words[index]}...
              </motion.span>
            </AnimatePresence>
          </div>

          {/* seconds counter */}
          <span className="ml-1 shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-500">
            {formatTime(seconds)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default Loading;