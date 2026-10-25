import { createSlice } from "@reduxjs/toolkit";

const messageSlice=createSlice({
    name: "message",
    initialState:{
        messages:[],
        artifacts:[]          // CHANGED: was missing
    },
    reducers:{
    setMessages:(state,action)=>{
        state.messages=action.payload
    },
    addMessage:(state,action)=>{
        state.messages.push(action.payload)
    },
    updateLastMessage:(state,action)=>{
        const last = state.messages[state.messages.length - 1]
        if (last) last.content = action.payload
    },
    setArtifacts: (state, action) => {
        state.artifacts = action.payload
    },
}
})

export const {setMessages, addMessage, updateLastMessage, setArtifacts}=messageSlice.actions
export default messageSlice.reducer