import api from '../../utils/axios.js'

const sendMessage = async (payload) => {
    try {
        const { data } = await api.post("/api/agent/chat", payload)
        return data
    } catch (error) {
        const message =
            error.response?.data?.message || error.message || "Something went wrong"
        console.error("sendMessage failed:", error.response?.status, message)
        return { error: message }
    }
}

export default sendMessage