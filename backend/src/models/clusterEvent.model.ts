import { Schema, model, Document } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     ClusterEvent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier of the cluster event.
 *         clusterId:
 *           type: string
 *           description: ID of the cluster this event belongs to.
 *         articleId:
 *           type: string
 *           description: ID of the article that triggered this event.
 *         ts:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the event occurred.
 *         kind:
 *           type: string
 *           enum: [first_report, official, update, analysis]
 *           description: Type of the cluster event.
 *         note:
 *           type: string
 *           description: Optional note about the event.
 */

export interface IClusterEvent extends Document {
  clusterId: any; // ObjectId
  articleId: any; // ObjectId
  ts: Date;
  kind: 'first_report' | 'official' | 'update' | 'analysis';
  note?: string;
}

const clusterEventSchema = new Schema<IClusterEvent>({
  clusterId: { type: Schema.Types.ObjectId, ref: 'Cluster', required: true },
  articleId: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
  ts: { type: Date, default: Date.now },
  kind: { 
    type: String, 
    enum: ['first_report', 'official', 'update', 'analysis'],
    required: true 
  },
  note: { type: String }
});

// Create indexes for timeline queries
clusterEventSchema.index({ clusterId: 1, ts: -1 });
clusterEventSchema.index({ articleId: 1 });

// Set a custom toJSON transform to enforce key ordering
clusterEventSchema.set("toJSON", {
  transform: function (doc, ret) {
    return {
      _id: ret._id,
      clusterId: ret.clusterId,
      articleId: ret.articleId,
      ts: ret.ts,
      kind: ret.kind,
      note: ret.note,
    };
  },
});

const ClusterEvent = model<IClusterEvent>("ClusterEvent", clusterEventSchema);
export default ClusterEvent;