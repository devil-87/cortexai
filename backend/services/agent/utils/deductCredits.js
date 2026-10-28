import axios from "axios"

export const deductCredits = async (userId, agent) => {
    try {
        const { data } = await axios.post(
            `${process.env.AUTH_SERVICE}/deduct-credits`,
            { userId, agent }
        )
        return data
    } catch (error) {
        if (error.response?.status === 402) {
            const err = new Error("Not enough credits")
            err.status = 402
            throw err
        }
        console.error("deductCredits error:", error.message)
        throw error
    }
}