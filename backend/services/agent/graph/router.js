import { getModel } from "../config/llmModels.js";

const VALID_AGENTS = ["chat", "search", "coding", "pdf", "ppt", "vision"];

// Static instructions: identical on every call, so providers can cache them
const SYSTEM_PROMPT = `You are a routing classifier. Read the user's message and choose the single best agent to handle it. Output ONLY the agent name in lowercase, with no punctuation, quotes or explanation.

AGENTS

chat    - Greetings, small talk, opinions, advice, writing help (emails, essays, stories, translation), math, general knowledge, and explanations of non-technical topics. This is the default.
search  - Needs live or recent information from the internet: news, today's or latest events, prices, weather, scores, "who is the current...", release dates, trending topics, anything after 2024, or when the user says "search", "look up", "google", "find online".
coding  - Writing, fixing, reviewing, explaining or designing code; error messages and stack traces; programming languages, frameworks, databases, APIs, algorithms, DevOps, project architecture, regex, SQL, shell commands.
pdf     - The user wants a PDF file created, or asks about the content of a PDF or document they uploaded (summarize, extract, answer from it).
ppt     - The user wants a presentation, slides, slide deck or PowerPoint created, or asks about an uploaded presentation.
vision  - The user wants an image created or edited: picture, photo, logo, poster, illustration, wallpaper, avatar, art, "draw", "generate an image of".

DECISION RULES (apply in order)
1. If the user asks for a specific output format (PDF, slides, image), choose that agent, whatever the topic. "Make a PPT on React hooks" is ppt, not coding.
2. If the answer needs current or real-time facts, choose search.
3. If the message involves code or a technical programming problem, choose coding.
4. Otherwise choose chat.
5. Judge by the user's latest intent, not by individual keywords. "Image" in "docker image" is coding. "Search algorithm" is coding. "Write a poem about the news" is chat.
6. If unsure, choose chat.

EXAMPLES
"hello how are you" -> chat
"explain photosynthesis simply" -> chat
"write an email asking for leave" -> chat
"what is 15% of 2400" -> chat
"latest news about India" -> search
"bitcoin price today" -> search
"who won yesterday's match" -> search
"build a navbar in React" -> coding
"why do I get undefined is not a function" -> coding
"difference between SQL and NoSQL" -> coding
"design a REST API for a todo app" -> coding
"create a PDF report on climate change" -> pdf
"summarize this document" -> pdf
"make a 10 slide presentation on AI" -> ppt
"create a pitch deck for my startup" -> ppt
"generate an image of a sunset over mountains" -> vision
"design a logo for my coffee shop" -> vision
"remove the docker image" -> coding`;

export const router = async (state) => {
  // User picked an agent manually
  if (state.agent && state.agent !== "auto") {
    return { ...state, agent: state.agent };
  }

  // FIXED: state.file is undefined when no file is attached, so use ?.
  // instead of reading .mimetype directly (that caused the crash)
  const mime = state.file?.mimetype;

  if (mime === "application/pdf") {
    return { ...state, agent: "pdfRag" };
  }

  if (mime?.startsWith("image/")) {
    return { ...state, agent: "imageAnalyzer" };
  }

  const llm = await getModel("router");

  // Long prompts add cost, not accuracy: the start of the message is enough to route
  const userPrompt = String(state.prompt ?? "").slice(0, 1500);

  const response = await llm.invoke([
    ["system", SYSTEM_PROMPT],
    ["human", `User message:\n${userPrompt}\n\nAgent:`],
  ]);

  // content can be a string or an array of parts, depending on the model
  const raw =
    typeof response.content === "string"
      ? response.content
      : response.content.map((part) => part.text ?? "").join("");

  const cleaned = raw.toLowerCase().replace(/[^a-z\s]/g, " ").trim();

  // Prefer an exact match; otherwise take the first valid agent word in the reply
  const picked =
    VALID_AGENTS.find((a) => a === cleaned) ??
    cleaned.split(/\s+/).find((word) => VALID_AGENTS.includes(word));

  return { ...state, agent: picked ?? "chat" };
};