import { getModel } from "../config/llmModels.js"
import { searchUnsplashImages, trackUnsplashDownloads } from "../config/unsplash.js"
import { deductCredits } from "../utils/deductCredits.js"   // ADDED

const getText = (content) =>
    typeof content === "string"
        ? content
        : content.map((part) => part.text ?? "").join("")

// read files out of the model reply (no JSON, so quotes and line breaks can't break it)
const parseFiles = (text) => {
    const files = []
    const regex = /=====FILE:\s*(.+?)=====\n([\s\S]*?)(?=\n=====FILE:|\n=====END=====|$)/g
    let m
    while ((m = regex.exec(text)) !== null) {
        files.push({
            name: m[1].trim(),
            content: m[2]
                .replace(/^```\w*\n?/, "")
                .replace(/\n?```\s*$/, "")
                .trim()
        })
    }
    return files
}

// ---------- UNSPLASH HELPERS ----------

// asks a small model which photos the project needs, then fetches real photos from Unsplash
const getUnsplashImages = async (userPrompt) => {
    try {
        const keywordLlm = await getModel("intent")
        const res = await keywordLlm.invoke(`
You pick photo search keywords for a website the user wants to build.

Return up to 5 short English keywords (1 or 2 words each), separated by commas,
for the photos this website needs. Use specific items (pizza, sushi, burger, gym, laptop),
not vague words. If the project needs no photos, return NONE.
Return ONLY the keywords.

User Request:
${String(userPrompt).slice(0, 500)}
`)

        const keywords = [
            ...new Set(
                getText(res.content)
                    .split(/[,\n]/)
                    .map((k) => k.replace(/[^\w\s]/g, "").trim().toLowerCase())
                    .filter((k) => k && k !== "none")
            )
        ].slice(0, 5)

        console.log("unsplash keywords:", keywords)
        if (keywords.length === 0) return []

        const groups = await Promise.all(
            keywords.map(async (keyword) => {
                try {
                    const images = await searchUnsplashImages(keyword, 3)
                    return images.length ? { keyword, images } : null
                } catch (err) {
                    console.log("unsplash failed for", keyword, "-", err.message)
                    return null
                }
            })
        )

        return groups.filter(Boolean)
    } catch (err) {
        console.log("unsplash step failed:", err.message)
        return []
    }
}

// turns the photos into text for the prompt
const buildImageRules = (groups) => {
    if (groups.length === 0) {
        // Unsplash failed or no photos needed: keep your old fallback
        return `- For images, use https://loremflickr.com/400/300/KEYWORD where KEYWORD is one word that matches the item (for example pizza, sushi, burger, pasta). Never use random placeholder images.
- Every image must have a meaningful alt attribute`
    }

    const list = groups
        .map(
            (g) =>
                `${g.keyword}:\n` +
                g.images
                    .map((img) => `  - ${img.url} | alt: ${img.alt} | credit: ${img.photographer} (${img.profile})`)
                    .join("\n")
        )
        .join("\n")

    return `- For images, use ONLY the real photo URLs listed below. Copy each URL exactly, character for character. Never invent or change image URLs.
- Pick the photo whose keyword matches the item. You may reuse a photo if you need more images than listed.
- Every image must have a meaningful alt attribute
- At the bottom of the page add a small footer line: "Photos from Unsplash" plus the photographers used, each linked to their credit URL

Available photos:
${list}`
}

// ---------- TITLE HELPERS (no AI: built from the user's prompt) ----------

const toTitleCase = (str) =>
    str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

const ACTION_LIST = ["generate", "create", "build", "make", "write", "design", "develop"]

// words that should never appear in the subject of a title
const TITLE_FILLER = new Set([
    "please", "can", "could", "would", "you", "i", "want", "need", "to", "give", "me",
    "show", "some", "code", "codes", "for", "on", "of", "about", "called", "named",
    "a", "an", "the", "my", "our", "this", "html", "css", "javascript", "js", "and", "is", "it"
])

// fix common spelling mistakes in action words: "genrate" -> "generate"
const fixTypos = (text) =>
    String(text)
        .replace(/\b(genrate|genarate|generete|generat|genreate|gernerate|genertae|generaet|genrete|genrerate)\b/gi, "generate")
        .replace(/\b(creat|craete|cretae)\b/gi, "create")
        .replace(/\b(buld|biuld|buil)\b/gi, "build")

// number of single-letter edits between two words
const editDistance = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
    for (let j = 1; j <= b.length; j++) dp[0][j] = j
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            )
        }
    }
    return dp[a.length][b.length]
}

// true for an action word or a close misspelling of "generate" ("genrate", "genrerate", ...)
const isActionWord = (w) => {
    const word = w.toLowerCase()
    if (ACTION_LIST.includes(word)) return true
    if (word.length >= 6 && editDistance(word, "generate") <= 1) return true
    if (word.length >= 7 && word.startsWith("gen") && word.endsWith("ate")) return true
    return false
}

// "Generate Navbar Code" / "Build Todo App Code": action + 1 or 2 subject words + Code (3 or 4 words)
const buildTitle = (userPrompt) => {
    const text = fixTypos(userPrompt).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
    const words = text.split(" ").filter(Boolean)

    // the action word the user used (default: Generate)
    const actionWord = words.find(isActionWord)?.toLowerCase()
    const action = ACTION_LIST.includes(actionWord) ? toTitleCase(actionWord) : "Generate"

    // keep at most 2 subject words, no action words, no filler, no repeats
    const pickSubject = (list) => {
        const seen = new Set()
        return list
            .filter((w) => {
                const lw = w.toLowerCase()
                if (isActionWord(w) || TITLE_FILLER.has(lw) || seen.has(lw)) return false
                seen.add(lw)
                return true
            })
            .slice(0, 2)
    }

    // cut extra details: "navbar with dropdown and dark mode" -> "navbar"
    const main = text
        .split(/\b(?:with|using|that|which|having|including|where|in)\b/i)[0]
        .split(" ")
        .filter(Boolean)

    const fromMain = pickSubject(main)
    const subject = fromMain.length ? fromMain : pickSubject(words)

    return subject.length
        ? toTitleCase(`${action} ${subject.join(" ")} Code`)
        : "Generated Code"
}

// ---------- CODING AGENT ----------

export const codingAgent=async (state) => {
    console.time("coding agent")
    const intentLlm=await getModel("intent")
    const llm= await getModel("coding")

    const intentRes=await intentLlm.invoke(`
        You are an intent classifier.

        Return ONLY one of these values.

        CODE_GENERATION
        CODE_REVIEW
        CODE_EXPLANATION
        DEBUGGING
        OPTIMIZATION
        CONVERSION
        DOCUMENTATION

        User Request:
        ${state.prompt}
    `)
    const intent = getText(intentRes.content).trim().toUpperCase()
    console.log("coding intent:", intent)

    if(intent.includes("CODE_GENERATION")){
        // CHANGED: title is built from the prompt (no AI call)
        const title = buildTitle(state.prompt)

        // ADDED (1/2): charge credits before the expensive steps.
        // Throws a 402 error if the user has no credits, so nothing below runs.
        const { credits } = await deductCredits(state.userId, "coding")

        const imageGroups = await getUnsplashImages(state.prompt)

        const prompt = `
You are CortexAI Coding Agent.

Generate the requested project as exactly 3 separate files.

Default stack: HTML, CSS, JavaScript.
Use React / Next.js / Vue ONLY if explicitly requested.

Files (use exactly these names):
1. index.html - markup only. It must include <link rel="stylesheet" href="style.css"> in the head and <script src="script.js"></script> before </body>
2. style.css - all styling
3. script.js - all logic

Design rules:
- Responsive
- Modern UI
- CSS Variables
- Flexbox/Grid
- Hover Effects
- Beautiful spacing
- Keep it compact: no unnecessary comments or boilerplate
${buildImageRules(imageGroups)}

Output format (follow exactly):

=====FILE: index.html=====
(full index.html code here)
=====FILE: style.css=====
(full style.css code here)
=====FILE: script.js=====
(full script.js code here)
=====END=====

Rules:
- Output the three files in exactly this format
- No JSON, no markdown, no code fences
- No explanation or extra text
- Never mention intent

User Request:
${state.prompt}
`
        const res = await llm.invoke(prompt)

        const files = parseFiles(getText(res.content))
        console.timeEnd("coding agent")

        if (files.length === 0) {
            throw new Error("Coding model returned no files (output may have been cut off)")
        }

        // tell Unsplash which photos were really used
        const allCode = files.map((f) => f.content).join("\n")
        const usedImages = imageGroups
            .flatMap((g) => g.images)
            .filter((img) => allCode.includes(img.url))
        trackUnsplashDownloads(usedImages)

        return {
            ...state,
            credits,
            aiResponse: "Code Generated Successfully.",
            artifacts:[
                {
                    id:Date.now(),
                    type:"Project",
                    title,
                    files
                }
            ]
        }
    }

    // ADDED (2/2): same charge for review / explain / debug / optimize / convert / docs
    const { credits } = await deductCredits(state.userId, "coding")

    const res = await llm.invoke(`
    The user's request type is:

    ${intent}

    Return Markdown only.

    Never generate project files.

    Use headings like:

    # Overview

    ## Explanation

    ## Improvements

    ## Best Practices

    ## Optimized Code (if needed)

    User Request:

    ${state.prompt}
    `)
    console.timeEnd("coding agent")

    return {
        ...state,
        credits,
        aiResponse: getText(res.content),
        artifacts:[]
    }
}