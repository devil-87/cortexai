import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { embeddings } from "./embeddings.js";
import dotenv from "dotenv"
dotenv.config()

// Qdrant Cloud needs the DATABASE API key of this cluster on every request.
// (Not the Google key, and not a "Cloud Management" key from the account settings.)
const qdrantConfig = {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    // skips the extra "check server version" call
    checkCompatibility: false,
};

// fail early with a clear message instead of a vague 403 from Qdrant
const assertConfig = () => {
    if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
        throw new Error(
            "QDRANT_URL or QDRANT_API_KEY is missing in the agent's .env file. Add both and restart the agent."
        );
    }
};

const client = () => new QdrantClient(qdrantConfig);

// Creates the collection (if needed) and stores the chunks in it.
export const vectorStore = async (docs, collectionName) => {
    assertConfig();
    return await QdrantVectorStore.fromDocuments(docs, embeddings, {
        ...qdrantConfig,
        collectionName,
    });
};

// true when this collection already exists and has chunks saved.
// Use it to skip re-embedding a PDF that was already processed.
export const collectionHasData = async (collectionName) => {
    assertConfig();
    try {
        const info = await client().getCollection(collectionName);
        return (info?.points_count ?? 0) > 0;
    } catch (error) {
        // CHANGED: only "not found" means the collection does not exist yet.
        // Before, every error (including a 403 from a bad key) was hidden here
        // and looked like "no collection", which made the real problem harder to see.
        if (error?.status === 404) return false;
        throw error;
    }
};

// opens a collection that was saved earlier, without uploading anything
export const existingVectorStore = async (collectionName) => {
    assertConfig();
    return await QdrantVectorStore.fromExistingCollection(embeddings, {
        ...qdrantConfig,
        collectionName,
    });
};