import { NotificationData } from "./notification.service";
import User from "../models/user.model";

/**
 * Sends a notification email for a new article that matches user's subscription
 */
export const sendNotificationEmail = async (notificationData: NotificationData): Promise<void> => {
  try {
    // Get environment variables
    const { RESEND_API_KEY, RESEND_FROM = "AI Curator <news@sonnguyenhoang.com>" } = process.env;
    
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured, skipping email notification");
      return;
    }

    // Import Resend dynamically
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    // Get user email
    const user = await User.findById(notificationData.userId);
    if (!user || !user.email) {
      console.error(`User not found or no email for userId: ${notificationData.userId}`);
      return;
    }

    const { article } = notificationData;
    const articleUrl = article.url;
    const shortUrl = new URL(articleUrl).hostname;

    // Create email content
    const subject = `🚨 New Article Alert: ${article.title}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin-bottom: 20px;
            }
            .article {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              margin-bottom: 20px;
              background: #f9fafb;
            }
            .article h2 {
              margin: 0 0 10px 0;
              color: #1f2937;
            }
            .article-meta {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 15px;
            }
            .article-summary {
              margin-bottom: 15px;
            }
            .topics {
              margin-bottom: 15px;
            }
            .topic {
              display: inline-block;
              background: #dbeafe;
              color: #1d4ed8;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              margin-right: 5px;
            }
            .read-more {
              display: inline-block;
              background: #3b82f6;
              color: white;
              padding: 10px 20px;
              text-decoration: none;
              border-radius: 5px;
              font-weight: 600;
            }
            .read-more:hover {
              background: #2563eb;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 14px;
              color: #6b7280;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📰 Article Alert</h1>
            <p>A new article matching your subscription has been published!</p>
          </div>
          
          <div class="article">
            <h2>${article.title}</h2>
            <div class="article-meta">
              <strong>Source:</strong> ${shortUrl} | 
              <strong>Published:</strong> ${new Date(article.fetchedAt).toLocaleDateString()}
            </div>
            
            ${article.summary ? `
              <div class="article-summary">
                <strong>Summary:</strong><br>
                ${article.summary}
              </div>
            ` : ''}
            
            ${article.topics && article.topics.length > 0 ? `
              <div class="topics">
                <strong>Topics:</strong><br>
                ${article.topics.map(topic => `<span class="topic">${topic}</span>`).join('')}
              </div>
            ` : ''}
            
            <a href="${articleUrl}" class="read-more" target="_blank">Read Full Article</a>
          </div>
          
          <div class="footer">
            <p>This alert was sent because the article matches your subscription preferences.</p>
            <p>You can manage your subscriptions by logging into your account.</p>
            <p><small>© 2024 AI Content Curator. All rights reserved.</small></p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
🚨 NEW ARTICLE ALERT

${article.title}

Source: ${shortUrl}
Published: ${new Date(article.fetchedAt).toLocaleDateString()}

${article.summary ? `Summary: ${article.summary}` : ''}

${article.topics && article.topics.length > 0 ? `Topics: ${article.topics.join(', ')}` : ''}

Read full article: ${articleUrl}

---
This alert was sent because the article matches your subscription preferences.
You can manage your subscriptions by logging into your account.
`;

    // Send email
    await resend.emails.send({
      from: RESEND_FROM,
      to: [user.email],
      subject,
      html: htmlContent,
      text: textContent,
    });

    console.log(`Sent article notification email to ${user.email} for: ${article.title}`);
  } catch (error) {
    console.error('Error sending notification email:', error);
    throw error;
  }
};