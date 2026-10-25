import { createSlice } from "@reduxjs/toolkit";

const conversationSlice=createSlice({
    name:"conversation",
    initialState:{
        conversations:[],
        selectedConversation:null
    },
    reducers: {
    setConversations: (state, action) => {
        state.conversations = action.payload
    },
    addConversation: (state, action) => {
        state.conversations.unshift(action.payload)
    },
    setSelectedConversation: (state, action) => {
        state.selectedConversation = action.payload
    },
    updateConversationTitle: (state, action) => {
        const {id,title}=action.payload
        const conv=state.conversations.find((c)=>c._id===id)
        if(conv) conv.title=title
        if(state.selectedConversation?._id===id) state.selectedConversation.title=title
    }
}
})


export const {setConversations,addConversation,setSelectedConversation,updateConversationTitle}=conversationSlice.actions
export default conversationSlice.reducer