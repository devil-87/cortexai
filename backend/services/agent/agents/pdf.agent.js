import { getModel } from "../config/llmModels.js"
import { generatePdf } from "../utils/generatePdf.js"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { getFromS3 } from "../utils/getFromS3.js"
import { deductCredits } from "../utils/deductCredits.js"   // ADDED

const getText = (content) =>
    typeof content === "string"
        ? content
        : content.map((part) => part.text ?? "").join("")

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
    // ADDED: charge credits OUTSIDE the try/catch below.
    // If it were inside, the catch would swallow the 402 "Not enough credits"
    // error and the user would only see "Failed to generate PDF".
    // The new balance is saved in `credits` and returned in the state.
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

        const filename=`pdf-${Date.now()}.pdf`
        await uploadToS3(filename,pdfBuffer,"application/pdf")

        const downloadUrl=await getFromS3(filename,60*10)

        return {
            ...state,
            credits,
            aiResponse:`# PDF Generated

**${data.title}**

📥 [Download PDF](${downloadUrl})

_Link expires in 10 minutes._`
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