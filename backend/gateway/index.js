import "dotenv/config";
import express from "express";
import proxy from "express-http-proxy"
import { proxyWithHeader } from "./utils/proxyWithHeader.js";
import cors from "cors"
import cookieParser from "cookie-parser"
import { protect } from "./middleware/auth.middleware.js";
import { getCurrentUser } from "./controllers/user.controller.js";
import morgan from "morgan";

const port = Number(process.env.PORT) || 8000
const app = express()
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}))
app.use(morgan("dev"))
app.use(cookieParser())
app.use("/api/auth", proxy(process.env.AUTH_SERVICE))
app.use("/api/chat",protect,proxyWithHeader(process.env.CHAT_SERVICE))
app.use("/api/agent",protect,proxyWithHeader(process.env.AGENT_SERVICE))
app.get("/api/me",protect,getCurrentUser)


const server = app.listen(port, () => {
    console.log(`Gateway server is running on port ${port}`);
});

server.on("error", (err) => {
    console.error("Gateway listen error:", err.code, err.message);
});