import Subscription from "../models/subscription.model";
import { IArticle } from "../models/article.model";
import { sendNotificationEmail } from "./email.service";

/**
 * Interface for notification data
 */
export interface NotificationData {
  article: IArticle;
  subscriptionId: string;
  userId: string;
  notificationType: 'email' | 'push';
}

/**
 * Checks if an article matches a subscription criteria
 */
export const doesArticleMatchSubscription = (
  article: IArticle, 
  subscription: any
): boolean => {
  // Check topics match
  if (subscription.topics && subscription.topics.length > 0) {
    const articleTopics = article.topics || [];
    const hasMatchingTopic = subscription.topics.some((topic: string) =>
      articleTopics.some((articleTopic: string) =>
        articleTopic.toLowerCase().includes(topic.toLowerCase())
      )
    );
    if (hasMatchingTopic) return true;
  }

  // Check keywords match in title, content, or summary
  if (subscription.keywords && subscription.keywords.length > 0) {
    const searchText = [
      article.title || '',
      article.content || '',
      article.summary || ''
    ].join(' ').toLowerCase();

    const hasMatchingKeyword = subscription.keywords.some((keyword: string) =>
      searchText.includes(keyword.toLowerCase())
    );
    if (hasMatchingKeyword) return true;
  }

  // Check sources match
  if (subscription.sources && subscription.sources.length > 0) {
    const hasMatchingSource = subscription.sources.some((source: string) =>
      article.source && article.source.toLowerCase().includes(source.toLowerCase())
    );
    if (hasMatchingSource) return true;
  }

  return false;
};

/**
 * Processes notifications for a newly ingested article
 */
export const processArticleNotifications = async (article: IArticle): Promise<void> => {
  try {
    // Get all active subscriptions with realtime mode
    const realtimeSubscriptions = await Subscription.find({ 
      mode: 'realtime',
      $or: [
        { emailEnabled: true },
        { pushEnabled: true }
      ]
    });

    const notifications: NotificationData[] = [];

    // Check each subscription for matches
    for (const subscription of realtimeSubscriptions) {
      if (doesArticleMatchSubscription(article, subscription)) {
        // Queue email notification if enabled
        if (subscription.emailEnabled) {
          notifications.push({
            article,
            subscriptionId: subscription._id.toString(),
            userId: subscription.userId,
            notificationType: 'email'
          });
        }

        // Queue push notification if enabled
        if (subscription.pushEnabled) {
          notifications.push({
            article,
            subscriptionId: subscription._id.toString(),
            userId: subscription.userId,
            notificationType: 'push'
          });
        }
      }
    }

    // Send notifications
    await Promise.all(notifications.map(sendNotification));
    
    if (notifications.length > 0) {
      console.log(`Sent ${notifications.length} notifications for article: ${article.title}`);
    }
  } catch (error) {
    console.error('Error processing article notifications:', error);
  }
};

/**
 * Sends a single notification
 */
const sendNotification = async (notificationData: NotificationData): Promise<void> => {
  try {
    if (notificationData.notificationType === 'email') {
      await sendNotificationEmail(notificationData);
    } else if (notificationData.notificationType === 'push') {
      // TODO: Implement push notifications
      console.log('Push notification would be sent for:', notificationData.article.title);
    }
  } catch (error) {
    console.error(`Failed to send ${notificationData.notificationType} notification:`, error);
  }
};

/**
 * Processes daily digest notifications for users with daily mode subscriptions
 */
export const processDailyDigestNotifications = async (): Promise<void> => {
  try {
    // Get all subscriptions with daily mode
    const dailySubscriptions = await Subscription.find({ 
      mode: 'daily',
      emailEnabled: true
    });

    // This would be called by a daily cron job
    // Implementation would gather articles from the past day and send digest emails
    console.log(`Processing daily digest for ${dailySubscriptions.length} subscriptions`);
    
    // TODO: Implement daily digest logic
  } catch (error) {
    console.error('Error processing daily digest notifications:', error);
  }
};