import { Schema, model, Document } from "mongoose";

export interface ICluster extends Document {
  canonicalTitle: string;
  summary: string;
  entityBag: {
    persons: string[];
    orgs: string[];
    places: string[];
    topics: string[];
  };
  articleIds: any[]; // ObjectId array
  sourceCounts: Record<string, number>;
  firstSeen: Date;
  lastUpdated: Date;
  quality: {
    coherence: number;
    size: number;
  };
}

const clusterSchema = new Schema<ICluster>({
  canonicalTitle: { type: String, required: true },
  summary: { type: String, required: true },
  entityBag: {
    persons: { type: [String], default: [] },
    orgs: { type: [String], default: [] },
    places: { type: [String], default: [] },
    topics: { type: [String], default: [] }
  },
  articleIds: [{ type: Schema.Types.ObjectId, ref: 'Article' }],
  sourceCounts: { type: Map, of: Number, default: new Map() },
  firstSeen: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  quality: {
    coherence: { type: Number, default: 0 },
    size: { type: Number, default: 0 }
  }
});

// Create indexes for performance
clusterSchema.index({ lastUpdated: -1 });
clusterSchema.index({ firstSeen: -1 });
clusterSchema.index({ 'quality.size': -1 });
clusterSchema.index({ 'quality.coherence': -1 });

// Set a custom toJSON transform to enforce key ordering and convert Map to Object
clusterSchema.set("toJSON", {
  transform: function (doc, ret) {
    return {
      _id: ret._id,
      canonicalTitle: ret.canonicalTitle,
      summary: ret.summary,
      entityBag: ret.entityBag,
      articleIds: ret.articleIds,
      sourceCounts: ret.sourceCounts instanceof Map ? Object.fromEntries(ret.sourceCounts) : ret.sourceCounts,
      firstSeen: ret.firstSeen,
      lastUpdated: ret.lastUpdated,
      quality: ret.quality,
    };
  },
});

const Cluster = model<ICluster>("Cluster", clusterSchema);
export default Cluster;