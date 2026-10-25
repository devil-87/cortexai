import api from "../../utils/axios.js" // <- use the path that works in getConversations.js

const logOut = async () => {
  try {
    const { data } = await api.get("/api/auth/logout");
    return data;
  } catch (error) {
    console.error("Logout failed:", error);
    throw error;
  }
};

export default logOut;