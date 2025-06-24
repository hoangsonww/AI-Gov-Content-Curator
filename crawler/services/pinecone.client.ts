import { Pinecone } from "@pinecone-database/pinecone";

const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

export const pcIndex = pc.Index(process.env.PINECONE_INDEX_NAME!);
