import "dotenv/config";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express";
import "../../shared/redis/redis.js";
import connectDb from "./config/db.js";
import router from "./routes/auth.route.js";

const port = process.env.PORT || 8001;
const app = express();

app.use(express.json());
app.use("/", router);

app.listen(port, () => {
  console.log(`Auth server is running on port ${port}`);
  connectDb();
});