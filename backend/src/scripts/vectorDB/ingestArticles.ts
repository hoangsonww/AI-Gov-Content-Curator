import {Pinecone} from '@pinecone-database/pinecone';
import * as dotenv from "dotenv";
import Article from "../../models/article.model.ts";
import {connectDB, disconnectDB} from "../../lib/db.ts";

dotenv.config();

const INDEX_NAME = 'ai-gov-content-curator'; //TODO: push to env
const NAMESPACE = 'ns1';
const CHUNK_SIZE = 7;


async function initPinecone() {
    /**
     * Check if index exist. If not create new.
     */
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
    });

    const indices = await pc.listIndexes();

    const isIndexExist: boolean = !!indices.indexes!.find((i) => i.name == INDEX_NAME);

    if (!isIndexExist) {
        console.log(`Creating index ${INDEX_NAME}...`);
        await pc.createIndexForModel({
            name: INDEX_NAME,
            cloud: 'aws',
            region: 'us-east-1',
            embed: {
                model: 'llama-text-embed-v2',
                fieldMap: { text: 'summary' },
            },
            waitUntilReady: true,
        });
        console.log(`Index ${INDEX_NAME} created successfully.`);
    } else {
        console.log(`Index ${INDEX_NAME} already exist. Using existing index.`)
    }

    return pc
}

function chunkArray<T>(array: T[], batchSize: number): T[][] {
    /**
     * Splits an array into chunks of specified size.
     * @param array The array to chunk.
     * @param batchSize The size of each chunk.
     * @returns An array of chunks.
     */
    return Array.from(
        { length: Math.ceil(array.length / batchSize) },
        (_, i) => array.slice(i * batchSize, (i + 1) * batchSize)
    );
}

async function upsertArticles(pc: Pinecone, filter: any = {}) {
    /**
     * Upsert articles into Pinecone vector database by batches.
     * @param pc The Pinecone client instance.
     * @param filter Optional filter to apply when fetching articles.
     */
    await connectDB();

    //TODO: implement filtering by source and topic?
    const articles = await Article.find(filter).select("-content -url -topics -title -source");

    const index = pc.index(INDEX_NAME).namespace(NAMESPACE);
    const chunks = chunkArray(articles, CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
        console.log(`Upserting chunk ${i + 1}/${chunks.length}...`);
        await index.upsertRecords(chunks[i]);
    }

    await disconnectDB();
}

(async () => {
    try {
        const pc = await initPinecone();
        await upsertArticles(pc);
    } catch (error) {
        console.error("Error:", error);
        await disconnectDB();
        process.exit(1);
    }
})();
