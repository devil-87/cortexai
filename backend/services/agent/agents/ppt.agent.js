import { getModel } from "../config/llmModels.js";
import { generatePpt } from "../utils/generatePpt.js";
import { uploadToS3 } from "../utils/uploadToS3.js";
import { getFromS3 } from "../utils/getFromS3.js";
import { attachImages } from "../utils/fetchImages.js";
import { researchTopic } from "../utils/researchTopic.js";

const PPT_MIME =
    "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const extractText = (content) => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .map((c) => (typeof c === "string" ? c : c?.text || ""))
            .join("");
    }
    return String(content ?? "");
};

const parseJson = (raw) => {
    let text = raw.trim();

    // remove ```json ... ``` fences if the model added them
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    // keep only the outermost { ... }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
        throw new Error("LLM did not return JSON");
    }

    return JSON.parse(text.slice(start, end + 1));
};

export const pptAgent = async (state) => {
    try {
        const llm = await getModel("ppt");

        // live web research so facts and numbers are current
        const research = await researchTopic(state.prompt);
        const today = new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });

        const prompt = `You are a professional presentation designer.

Return ONLY valid JSON.

Format:

{
  "title": "",
  "subtitle": "",
  "theme": "ONE of: aurora, ocean, sunset, emerald, midnight, berry (pick the one that suits the topic: sports -> ocean or sunset, tech -> aurora or midnight, nature -> emerald, culture -> berry)",
  "personName": "exact English Wikipedia article title if the topic is a real person (e.g. Virat Kohli), otherwise null",
  "imageTopic": "ONE lowercase word for the general field, e.g. cricket, space, medicine",
  "imageQuery": "2-3 word photo search for the cover",
  "slides": [
    {
      "title": "",
      "imageQuery": "2-3 word photo search for this slide",
      "points": ["", "", "", ""],
      "notes": "2-3 sentences the speaker can say"
    }
  ]
}

Rules:

- Generate exactly 6 content slides.
- Each slide should have 4-5 concise bullet points.
- Each point must be under 12 words.
- imageTopic is the general field of the topic (for a cricketer use "cricket").
- imageQuery must describe something concrete and photographable in that field, such as "batsman cover drive", "stadium crowd", "trophy celebration". Never use names of real people, and never abstract words like "leadership" or "legacy".
- Today's date is ${today}. Your own memory may be out of date.
- Use ONLY the RESEARCH section below for facts, numbers, dates, records and statistics. Never use numbers from memory.
- If sources disagree, use the most recent figure. Write career totals (runs, centuries, averages, rankings) as "as of <Month Year>".
- If a fact is not in the research, leave it out instead of guessing.
- If the topic is a person, cover: early life, debut (date and opponent), first major achievement, best performance, current career totals, and recent news.
- No markdown.
- No explanation.
- No code block.
- Return ONLY JSON.

Topic:

${state.prompt}

RESEARCH:

${research.text || "(no research available - keep claims general and avoid specific numbers)"}`;

        const res = await llm.invoke(prompt);
        const data = parseJson(extractText(res.content));

        if (!Array.isArray(data.slides) || data.slides.length === 0) {
            throw new Error("LLM returned no slides");
        }

        await attachImages(data); // photos for cover + slides

        if (research.sources.length) {
            data.credits = [...(data.credits || []), `Facts from: ${research.sources.join(", ")}`];
        }

        const ppt = await generatePpt(data);
        const buffer = await ppt.write({ outputType: "nodebuffer" });

        const filename = `ppt-${Date.now()}.pptx`;

        await uploadToS3(filename, buffer, PPT_MIME);
        const downloadUrl = await getFromS3(filename, 24 * 60 * 60);

        return {
            ...state,
            aiResponse: `# ✅ Presentation Generated

**${data.title}**

📥 [Download PPT](${downloadUrl})

_Link expires in 24 hours._`,
        };
    } catch (error) {
        console.error("PPT agent error:", error);
        return {
            ...state,
            aiResponse: "Failed to generate PPT..",
        };
    }
};