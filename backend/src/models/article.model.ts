import { Schema, model, Document } from 'mongoose';

export interface IArticle extends Document {
    url: string;
    title: string;
    content: string;
    summary: string;
    source: string;
    fetchedAt: Date;
}

const articleSchema = new Schema<IArticle>({
    url: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    summary: { type: String },
    source: { type: String, required: true },
    fetchedAt: { type: Date, default: Date.now }
});

export default model<IArticle>('Article', articleSchema);
