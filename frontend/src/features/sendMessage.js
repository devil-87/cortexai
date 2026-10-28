import api from '../../utils/axios.js'

const sendMessage = async (payload) => {
    try {
        const { data } = await api.post("/api/agent/chat", payload)
        return data
    } catch (error) {
        const message =
            error.response?.data?.message || error.message || "Something went wrong"
        console.error("sendMessage failed:", error.response?.status, message)
        // CHANGED: also return the status, so the UI can detect 402 (not enough credits)
        return { error: message, status: error.response?.status }
    }
}

export default sendMessage