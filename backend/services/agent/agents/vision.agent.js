import { getModel } from "../config/llmModels.js"
import axios from "axios"
import { uploadToS3 } from "../utils/uploadToS3.js"
import { getFromS3 } from "../utils/getFromS3.js"

const BASE_URL = "https://gen.pollinations.ai/image"
const MODELS = ["flux"]
const MAX_RETRIES = 3

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Error bodies arrive as a Buffer because of responseType: "arraybuffer"
const readError = (error) => {
    const status = error.response?.status
    let detail = error.message
    try {
        if (error.response?.data) {
            detail = Buffer.from(error.response.data).toString("utf8")
        }
    } catch {
        // keep default message
    }
    return { status, detail }
}

const buildImageUrl = (prompt, model) => {
    const params = new URLSearchParams({
        model,
        width: "1024",
        height: "1024",
        nologo: "true",
        // small integer; Date.now() is too large
        seed: String(Math.floor(Math.random() * 1000000)),
    })
    if (process.env.POLLINATIONS_API_KEY) {
        params.set("key", process.env.POLLINATIONS_API_KEY)
    }
    return `${BASE_URL}/${encodeURIComponent(prompt)}?${params.toString()}`
}

const fetchImage = async (prompt) => {
    let lastError

    for (const model of MODELS) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await axios.get(buildImageUrl(prompt, model), {
                    responseType: "arraybuffer",
                    timeout: 90000,
                })

                const contentType = res.headers["content-type"] || ""
                if (!contentType.startsWith("image/")) {
                    throw new Error(`Unexpected content type: ${contentType}`)
                }
                return { data: res.data, contentType }
            } catch (error) {
                lastError = error
                const { status, detail } = readError(error)
                console.error(
                    `Pollinations ${status ?? "error"} (model=${model}, attempt ${attempt}/${MAX_RETRIES}):`,
                    detail
                )

                // 400/401/402/403 won't fix themselves by retrying the same model
                const retryable = !status || [429, 500, 502, 503, 504].includes(status)
                if (!retryable) break
                if (attempt < MAX_RETRIES) await sleep(1000 * 2 ** (attempt - 1))
            }
        }
    }

    throw lastError
}

const extensionFor = (contentType) => {
    if (contentType.includes("png")) return "png"
    if (contentType.includes("webp")) return "webp"
    return "jpg"
}

export const visionAgent = async (state) => {
    try {
        if (!process.env.POLLINATIONS_API_KEY) {
            console.warn("POLLINATIONS_API_KEY is not set - image requests may fail with 402")
        }

        const llm = await getModel("image")

        const res = await llm.invoke(`
You are an elite AI image prompt engineer.

Convert the user request into ONE image generation prompt.

Rules:
- Maximum 70 words.
- Keep EVERY subject the user mentioned (for example, if they ask for a dog with a car, both the dog and the car must appear clearly in the scene).
- Put the main subjects first, then the setting.
- End with a short style list: cinematic lighting, photorealistic, sharp focus, shallow depth of field, high detail, professional photography.
- Use plain ASCII characters only (no fancy hyphens or curly quotes).
- Return only the prompt, with no quotes or extra text.

User Request:
${state.prompt}
`)

        const prompt = String(res.content)
            .replace(/[\u2010-\u2015\u2212]/g, "-")
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 600)

        const { data, contentType } = await fetchImage(prompt)

        const buffer = Buffer.from(data)
        const filename = `image-${Date.now()}.${extensionFor(contentType)}`

        await uploadToS3(filename, buffer, contentType)

        const expiresInSeconds = 24 * 60 * 60
        const downloadUrl = await getFromS3(filename, expiresInSeconds)

        return {
            ...state,
            aiResponse: `
# 🖼️ Image Generated Successfully

![Generated Image](${downloadUrl})

📥 [Download Image](${downloadUrl})

⏳ Link expires in 24 hours.`
        }
    } catch (error) {
        const { status, detail } = readError(error)
        console.error("vision agent error:", status, detail)

        const reason =
            status === 402
                ? "the image service needs a valid API key or credits."
                : status === 503
                ? "the image service is temporarily unavailable. Please try again shortly."
                : "something went wrong."

        return {
            ...state,
            aiResponse: `❌ Failed to generate image: ${reason}`
        }
    }
}