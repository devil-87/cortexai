import api from '../../utils/axios.js'

// Sends a chat message to the backend.
// Accepts a FormData (text + optional file) or a plain object (text only).
const sendMessage = async (payload) => {
    try {
        const isFormData = payload instanceof FormData

        // FIXED: if the shared axios instance sets a default JSON Content-Type,
        // the file would be sent as text and req.file would stay empty on the
        // server. For FormData we override it with multipart/form-data; axios
        // and the browser then add the correct "boundary" part by themselves.
        const config = isFormData
            ? { headers: { "Content-Type": "multipart/form-data" } }
            : undefined

        const { data } = await api.post("/api/agent/chat", payload, config)
        return data
    } catch (error) {
        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Something went wrong"
        console.error("sendMessage failed:", error.response?.status, message)
        // Also return the status, so the UI can detect 402 (not enough credits)
        return { error: message, status: error.response?.status }
    }
}

export default sendMessage