import { searchTool } from "../config/tavily.js"
import { deductCredits } from "../utils/deductCredits.js"   // ADDED

export const searchAgent=async (state) => {
    // ADDED: charge credits OUTSIDE the try/catch below, so a 402
    // "Not enough credits" error reaches the controller instead of being
    // swallowed by the catch and turned into empty search results.
    // The new balance is saved in `credits` and returned in the state.
    const { credits } = await deductCredits(state.userId,"search")

    try {
        const results=await searchTool.invoke({
            query:state.prompt
        })
        console.log(results)
        return {
            ...state,
            credits,
            searchResults:results,
            images:results.images
        }
    } catch (error) {
        return {
            ...state,
            credits,
            searchResults:[],
            images:[]
        }
    }
}