import { getModel } from "../config/llmModels.js"

export const generateTitle=async (prompt) => {
    try {
        const llm=await getModel("chat")
        const response=await llm.invoke([
            {
                "role":"system",
                "content":"Write a short chat title (maximum 5 words) that summarizes the user's message. Reply with ONLY the title. No quotes, no markdown, no full stop at the end."
            },
            {
                "role":"human",
                "content":prompt
            }
        ])

        const title=String(response.content).replace(/["'`#*]/g,"").trim().slice(0,60)
        // if the AI gives nothing useful, use the start of the message
        return title || prompt.slice(0,40)
    } catch (error) {
        console.log(error)
        return prompt.slice(0,40)
    }
}