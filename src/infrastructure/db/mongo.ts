import {MongoClient, type Db} from "mongodb";
import {env} from "../../config/env.js"
import {logger} from "../../config/logger.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
    if(db) return db;
    client = new MongoClient(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
    });
    await client.connect();
    db = client.db(env.MONGODB_DB_NAME);

    logger.info({ db: env.MONGODB_DB_NAME }, "Connected to MongoDB");
    return db;
}

export function getDb(): Db {
    if(!db) 
        throw new Error("Database not yet initialized");
    return db;
}

export async function disconnectFromDatabase(): Promise<void> {
    if(client) {
        await client.close();
        client = null;
        db = null;
        logger.info("Disconnect from db");
    }
}