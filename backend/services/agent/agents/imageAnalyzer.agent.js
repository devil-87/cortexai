import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { getModel } from "../config/llmModels.js"
import fs from "fs/promises"
import sharp from "sharp"
import { deductCredits } from "../utils/deductCredits.js"

// Gemini reads these image types. Anything else (gif, svg, pdf) is rejected early.
const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

const SYSTEM_PROMPT = `You are CortexAI Image Analyzer. You answer questions about one uploaded image.

Core rules:
- Answer exactly what the user asked, first, with no introduction. Do not repeat the question or say "Based on the image".
- Use only what is visible. If something is blurry, cut off or hidden, say so. Never fill gaps with guesses.
- Reply in the language the user wrote in. Keep text from the image in its original language.
- Match the length to the question. A specific question ("what colour is the dog?", "what is the total?") gets 1-3 sentences. A general question ("what is this?", "describe it") gets a fuller description, as explained in the task note below.
- Use Markdown only for lists, tables and code.

Describing an image (general questions):
- Start with one clear sentence that says what the image is: the type of object or scene and its main subject.
- Then add the details that matter, most important first: colours and materials, any visible text (copied exactly), people or animals (clothing, pose, action, viewing angle), background and setting.
- Say what kind of image it is: real photo, product mockup, digital illustration, drawing, screenshot or scan.
- Mention only what you can see. Leave out anything that is not visible, even if it would be typical for this kind of image.

When reading text from the image (accuracy rules):
- Copy text exactly as written. Do not fix spelling, grammar or formatting.
- Keep numbers, currency symbols, dates, units, IDs and phone numbers character by character.
- Keep the original line breaks and reading order (top to bottom, left to right).
- Mark anything you cannot read as [unclear]. Never guess a word or a digit.
- Look again at every number before answering, especially similar ones (0/O, 1/l/I, 5/S, 8/B).
- Handwriting: transcribe what you can and mark the rest [unclear].

By image type:
- Tables: output a Markdown table with the same rows and columns. Keep empty cells empty.
- Charts: give the chart type, axis titles and units, the main trend, and the visible values. Say "approximately" for values you estimate from bars or lines.
- Code or error screenshots: put the code in a code block, name the problem, then give the fix.
- Receipts, invoices and forms: list each field as "Label: value", including the total, and check that the line items add up to it.
- Photos: describe the main subject, setting and notable details.

People:
- Do not identify real people from their faces. Describe appearance, clothing and actions instead.
- Name a person only when a caption, name tag or other visible text says who they are.
`

// pick one short extra instruction from the user's wording (no extra model call).
// The first rule that matches wins, so the order matters.
const getModeHint = (prompt = "") => {
    const p = prompt.toLowerCase()

    // CHANGED: the words "read" and "text" alone no longer switch to text-only mode,
    // so "read this image and tell me what it is" is treated as a normal description
    if (/\b(ocr|transcribe|extract (the |all )?text|read (the |all )?text|what does (it|this) say|text (in|from) (the |this )?(image|picture|photo))\b/.test(p)) {
        return "Task: transcribe ALL visible text exactly. Output only the text, nothing else."
    }
    if (/\b(table|rows|columns|spreadsheet)\b/.test(p)) {
        return "Task: rebuild the table as a Markdown table, then add one line of summary."
    }
    if (/\b(chart|graph|trend|plot)\b/.test(p)) {
        return "Task: explain the chart: type, axes, main trend, key values."
    }
    if (/\b(source code|code snippet|error|bug|exception|stack ?trace|fix)\b/.test(p)) {
        return "Task: copy the code in a code block, explain the issue, give the fix."
    }

    // ADDED: general questions get a fuller, more useful description
    const isGeneral =
        p.trim() === "" ||
        /\b(what('s| is) (it|this|that|in (this|the) (image|picture|photo|file))|describe|identify|tell me about|content|explain (this|the) (image|picture|photo))\b/.test(p)
    if (isGeneral) {
        return "Task: general description. Begin with one sentence saying what the image is (type of object or scene and its main subject). Then add the important details in 3-6 short sentences or bullets: colours and materials, visible text copied exactly, people or animals (clothing, pose, action; do not identify anyone from their face), the style (photo, illustration, mockup, screenshot) and the setting. Do not mention anything that is not visible."
    }

    return ""
}

// Gemini can return content as an array of parts instead of a string
const toText = (content) => {
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
        return content.map(p => (typeof p === "string" ? p : p?.text ?? "")).join("").trim()
    }
    return ""
}

export const imageAnalyzer = async (state) => {
    try {
        // stop early, before spending any time or credits on the model
        if (!state.file) {
            return { ...state, aiResponse: "Please upload an image to analyze." }
        }
        if (!SUPPORTED_TYPES.includes(state.file.mimetype)) {
            return { ...state, aiResponse: "This file type is not supported. Please upload a PNG, JPEG, WEBP or HEIC image." }
        }
        if (state.file.size > MAX_SIZE) {
            return { ...state, aiResponse: "This image is too large. Please upload one under 10 MB." }
        }

        // getModel is async in llmModels.js, so await is required here
        const llm = await getModel("imageAnalyzer")
        await deductCredits(state.userId, "vision")

        let imageBuffer = await fs.readFile(state.file.path)
        let mimeType = state.file.mimetype

        // shrink big phone photos: faster upload, same accuracy
        try {
            imageBuffer = await sharp(imageBuffer)
                .rotate()                                   // fix sideways phone photos
                .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .toBuffer()
            mimeType = "image/jpeg"
        } catch (e) {
            // if sharp cannot read the file (for example some HEIC files), send the original
        }

        const base64Image = imageBuffer.toString("base64")

        const modeHint = getModeHint(state.prompt)

        const messages = [
            new SystemMessage(SYSTEM_PROMPT + (modeHint ? `\n${modeHint}` : "")),
            new HumanMessage({
                content: [
                    // image first, then the question: Gemini reads a single image better this way
                    {
                        type: "image_url",
                        image_url: { url: `data:${mimeType};base64,${base64Image}` }
                    },
                    {
                        type: "text",
                        text: state.prompt || "Describe this image and point out anything important."
                    }
                ]
            })
        ]

        const response = await llm.invoke(messages)
        const answer = toText(response.content)

        if (!answer) {
            return { ...state, aiResponse: "I could not read anything from this image. Please try a clearer one." }
        }

        return { ...state, aiResponse: answer }

    } catch (error) {
        // FIXED: "not enough credits" (402) used to be swallowed here and shown as
        // "Failed to analyze the image". It must reach the controller, so the
        // frontend gets a 402 and can open the Billing drawer.
        if (error.status === 402) {
            throw error
        }

        console.log("imageAnalyzer error:", error)

        // tell the user something useful instead of one generic message
        if (error.status === 429) {
            return { ...state, aiResponse: "The image service is busy right now. Please try again in a minute." }
        }
        return { ...state, aiResponse: "Failed to analyze the image. Please try again." }
    } finally {
        // always delete the temp file, even after an early return or an error
        if (state.file?.path) {
            await fs.unlink(state.file.path).catch(() => {})
        }
    }
}