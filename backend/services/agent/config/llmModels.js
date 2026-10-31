import dotenv from "dotenv";
dotenv.config();
import { ChatGroq } from "@langchain/groq";
import { ChatOpenRouter } from "@langchain/openrouter";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"

const groq=new ChatGroq({
    model:"openai/gpt-oss-120b"
})

// "gemini-flash-latest" is an alias that always points to the newest Flash model,
// so it won't break when a version is renamed. Use "gemini-3.6-flash" to pin a version.
const gemini=new ChatGoogleGenerativeAI({
    model:"gemini-flash-latest"
})

// for imageanalyzer only i use this 
const geminiImageAnalyzer=new ChatGoogleGenerativeAI({
    model:"gemini-3.7-flash",
    temperature:0
})

const openrouter = new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature: 0,
  maxTokens: 2500
})

export const getModel=async (agent)=>{
    switch (agent) {
        case "chat":
            return groq;
        case "search":
            return groq;
        case "router":
            return groq;
        case "intent":
            return groq;
        case "coding":
            return gemini;
        case "imageAnalyzer":
            return geminiImageAnalyzer;
        case "pdf":
            return groq;
        default:
            return groq;
    }
}