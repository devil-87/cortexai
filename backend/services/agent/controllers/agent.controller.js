import axios from "axios"
import { graph } from "../graph/graph.js"
import { addMessage } from "../config/memory.js"
import { generateTitle } from "../utils/generateTitle.js"


export const agent=async (req,res) => {
    try {
        const {prompt,conversationId,isFirstMessage,agent}=req.body

        // [userId 1/3] read the id the gateway attached after verifying the token.
        // It comes from the header, not req.body, so a client cannot fake it.
        const userId=req.headers["x-user-id"]

        // [userId 2/3] stop early if the gateway did not send it
        if(!userId){
            return res.status(401).json({message:"Missing user id"})
        }

        await axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
            conversationId,role:"user",content:prompt
        })

        // the title is written at the same time as the answer, so it adds no waiting time
        const [result,title]=await Promise.all([
            graph.invoke({
                // [userId 3/3] pass it into the graph so every node can read state.userId
                prompt,conversationId,agent,userId
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

        // credits = the new balance, so the frontend can update the screen without a refresh
        return res.status(200).json({response,title,images,artifacts,credits:result.credits})
        
    } catch (error) {
        // not enough credits: tell the frontend with 402 so it can open the Billing drawer
        if(error.status===402){
            return res.status(402).json({message:"Not enough credits"})
        }
        console.error("agent controller error:",error)
        return res.status(500).json({message:`agent error ${error}`})
    }
}