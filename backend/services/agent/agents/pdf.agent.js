import crypto from "node:crypto"
import { getModel } from "../config/llmModels.js"
import { generatePdf } from "../utils/generatePdf.js"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { deductCredits } from "../utils/deductCredits.js"

// FIXED: the download link used to last only 10 minutes (60*10), so any PDF opened later
// from the chat history showed "AccessDenied - Request has expired".
// Now it lasts 24 hours, the same as the image links. The maximum S3 allows is 7 days.
const LINK_SECONDS = 60 * 60 * 24

const getText = (content) =>
    typeof content === "string"
        ? content
        // FIXED: parts can be plain strings too, and part.text would be undefined for them
        : content.map((part) => (typeof part === "string" ? part : part?.text ?? "")).join("")

// models sometimes wrap JSON in ```json fences or add text around it
const parseJson = (text) => {
    const raw = String(text).replace(/```json/gi, "").replace(/```/g, "").trim()
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start === -1 || end === -1) throw new Error("Model did not return JSON")
    return JSON.parse(raw.slice(start, end + 1))
}

// make sure the PDF generator always gets clean data
const normalizeDoc = (data, prompt) => ({
    title: String(data?.title || prompt).trim().slice(0, 120),
    subtitle: data?.subtitle ? String(data.subtitle).trim() : "",
    sections: (Array.isArray(data?.sections) ? data.sections : [])
        .map((s) => ({
            heading: String(s?.heading || "").trim(),
            points: (Array.isArray(s?.points) ? s.points : [])
                .map((p) => String(p).trim())
                .filter(Boolean)
        }))
        .filter((s) => s.heading || s.points.length)
})

export const pdfAgent=async (state) => {
    // charge credits OUTSIDE the try/catch below.
    // If it were inside, the catch would swallow the 402 "Not enough credits"
    // error and the user would only see "Failed to generate PDF".
    const { credits } = await deductCredits(state.userId, "pdf")

    try {
        const llm=await getModel("pdf")
        const prompt=`
        You are an expert document writer.

Return ONLY valid JSON.

Do NOT return markdown.

Do NOT return explanations.

Structure:

{
"title":"",
"subtitle":"",
"sections":[
{
"heading":"",
"points":[]
}
]
}

Generate 4-8 sections.

Each section should have 3-6 concise bullet points.

Topic:

${state.prompt}
        `

        const res= await llm.invoke(prompt)
        const data= normalizeDoc(parseJson(getText(res.content)), state.prompt)

        if (data.sections.length === 0) {
            throw new Error("Model returned no sections")
        }

        const pdfBuffer=await generatePdf(data)

        // FIXED: a random part is added, so two requests in the same millisecond cannot overwrite each other
        const filename=`pdf-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.pdf`
        await uploadToS3(filename,pdfBuffer,"application/pdf")

        // the third argument makes the link download the file with the document title as its name
        const downloadUrl=await getFromS3(filename, LINK_SECONDS, `${data.title}.pdf`)

        const hours = Math.round(LINK_SECONDS / 3600)

        return {
            ...state,
            credits,
            aiResponse:`# PDF Generated

**${data.title}**

📥 [Download PDF](${downloadUrl})

_Link expires in ${hours} hours._`
        }
    } catch (error) {
        console.log("pdf agent error:", error)
        return {
            ...state,
            credits, // credits were already spent, so the screen must show the new balance
            aiResponse:"Failed to generate PDF. Please try again."
        }
    }
}