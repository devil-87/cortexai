import axios from "axios"
import { graph } from "../graph/graph.js"
import { addMessage } from "../config/memory.js"
import { generateTitle } from "../utils/generateTitle.js"


export const agent=async (req,res) => {
    try {
        const {prompt,conversationId,isFirstMessage,agent}=req.body


        await axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
            conversationId,role:"user",content:prompt
        })

        // the title is written at the same time as the answer, so it adds no waiting time
        const [result,title]=await Promise.all([
            graph.invoke({
                prompt,conversationId,agent
            }),
            isFirstMessage ? generateTitle(prompt) : null
        ])
        const response=result.aiResponse

        if(!response){
            throw new Error(`Agent "${result.agent}" returned no aiResponse`)
        }

        // images only exist when the search agent ran, otherwise send an empty list
        const images=result.images ?? []

        // artifacts only exist when an agent created them, otherwise send an empty list
        const artifacts=result.artifacts ?? []

        await addMessage(conversationId,"user",prompt)
        await addMessage(conversationId,"assistant",response)
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
            conversationId,role:"assistant",content:response,images,artifacts
        })

        // save the new title in the database (a failure here must not break the chat)
        if(title){
            try {
                await axios.post(`${process.env.CHAT_SERVICE}/update-conversation`,{
                    id:conversationId,title
                })
            } catch (error) {
                console.log(error)
            }
        }

        return res.status(200).json({response,title,images,artifacts})
        
    } catch (error) {
        console.error("agent controller error:",error)
        return res.status(500).json({message:`agent error ${error}`})
    }
}