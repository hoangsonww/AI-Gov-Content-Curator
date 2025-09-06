import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { toast } from "react-toastify";
import { 
  MdNotificationsActive, 
  MdEmail, 
  MdPhoneAndroid,
  MdAdd,
  MdDelete,
  MdEdit,
  MdSave,
  MdCancel 
} from "react-icons/md";
import { 
  getUserSubscriptions, 
  createSubscription, 
  updateSubscription, 
  deleteSubscription, 
  getTopics,
  getSources,
  validateToken,
  Subscription 
} from "../services/api";

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [token, setToken] = useState<string>("");
  
  // Form state for creating/editing subscriptions
  const [formData, setFormData] = useState<Partial<Subscription>>({
    topics: [],
    keywords: [],
    sources: [],
    mode: 'realtime',
    emailEnabled: true,
    pushEnabled: false,
  });
  
  const [newKeyword, setNewKeyword] = useState("");
  const router = useRouter();

  useEffect(() => {
    const initializePage = async () => {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        toast.error("Please login to manage subscriptions");
        router.push("/auth/login");
        return;
      }

      const isValid = await validateToken(storedToken);
      if (!isValid) {
        toast.error("Session expired. Please login again.");
        router.push("/auth/login");
        return;
      }

      setToken(storedToken);
      await Promise.all([
        loadSubscriptions(storedToken),
        loadTopics(),
        loadSources()
      ]);
      setLoading(false);
    };

    initializePage();
  }, []);

  const loadSubscriptions = async (authToken: string) => {
    try {
      const userSubscriptions = await getUserSubscriptions(authToken);
      setSubscriptions(userSubscriptions);
    } catch (error: any) {
      console.error("Failed to load subscriptions:", error);
      toast.error("Failed to load subscriptions");
    }
  };

  const loadTopics = async () => {
    try {
      const topicsData = await getTopics("", 1, 100);
      setTopics(topicsData.data);
    } catch (error: any) {
      console.error("Failed to load topics:", error);
    }
  };

  const loadSources = async () => {
    try {
      const sourcesData = await getSources();
      setSources(sourcesData);
    } catch (error: any) {
      console.error("Failed to load sources:", error);
    }
  };

  const handleCreateSubscription = async () => {
    if (!token) return;
    
    setSaving(true);
    try {
      const newSubscription = await createSubscription(token, formData);
      setSubscriptions([...subscriptions, newSubscription]);
      setShowCreateForm(false);
      resetForm();
      toast.success("Subscription created successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create subscription");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSubscription = async (id: string) => {
    if (!token) return;
    
    setSaving(true);
    try {
      const updatedSubscription = await updateSubscription(token, id, formData);
      setSubscriptions(subscriptions.map(sub => 
        sub._id === id ? updatedSubscription : sub
      ));
      setEditingId(null);
      resetForm();
      toast.success("Subscription updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update subscription");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!token || !confirm("Are you sure you want to delete this subscription?")) return;
    
    setSaving(true);
    try {
      await deleteSubscription(token, id);
      setSubscriptions(subscriptions.filter(sub => sub._id !== id));
      toast.success("Subscription deleted successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete subscription");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      topics: [],
      keywords: [],
      sources: [],
      mode: 'realtime',
      emailEnabled: true,
      pushEnabled: false,
    });
    setNewKeyword("");
  };

  const startEditing = (subscription: Subscription) => {
    setFormData({
      topics: subscription.topics || [],
      keywords: subscription.keywords || [],
      sources: subscription.sources || [],
      mode: subscription.mode,
      emailEnabled: subscription.emailEnabled,
      pushEnabled: subscription.pushEnabled,
    });
    setEditingId(subscription._id || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    resetForm();
  };

  const startCreating = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const cancelCreating = () => {
    setShowCreateForm(false);
    resetForm();
  };

  const toggleTopic = (topic: string) => {
    const currentTopics = formData.topics || [];
    if (currentTopics.includes(topic)) {
      setFormData({ ...formData, topics: currentTopics.filter(t => t !== topic) });
    } else {
      setFormData({ ...formData, topics: [...currentTopics, topic] });
    }
  };

  const toggleSource = (source: string) => {
    const currentSources = formData.sources || [];
    if (currentSources.includes(source)) {
      setFormData({ ...formData, sources: currentSources.filter(s => s !== source) });
    } else {
      setFormData({ ...formData, sources: [...currentSources, source] });
    }
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const currentKeywords = formData.keywords || [];
    if (!currentKeywords.includes(newKeyword.trim())) {
      setFormData({ ...formData, keywords: [...currentKeywords, newKeyword.trim()] });
    }
    setNewKeyword("");
  };

  const removeKeyword = (keyword: string) => {
    const currentKeywords = formData.keywords || [];
    setFormData({ ...formData, keywords: currentKeywords.filter(k => k !== keyword) });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading subscriptions...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Subscriptions – AI Content Curator</title>
        <meta
          name="description"
          content="Manage your article subscriptions and notification preferences"
        />
      </Head>

      <div className="subscriptions-container">
        <header className="page-header">
          <div className="header-content">
            <MdNotificationsActive className="header-icon" size={35} />
            <div>
              <h1>Subscription Manager</h1>
              <p>Create custom subscriptions to receive real-time alerts for articles matching your interests</p>
            </div>
          </div>
          
          <button 
            className="btn create-btn"
            onClick={startCreating}
            disabled={saving || showCreateForm}
          >
            <MdAdd /> New Subscription
          </button>
        </header>

        {/* Create Form */}
        {showCreateForm && (
          <div className="subscription-form">
            <h3>Create New Subscription</h3>
            
            {/* Topics Selection */}
            <div className="form-section">
              <label>Topics</label>
              <div className="topics-grid">
                {topics.slice(0, 20).map(topic => (
                  <label key={topic} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.topics?.includes(topic) || false}
                      onChange={() => toggleTopic(topic)}
                    />
                    <span className="checkbox-text">{topic}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Keywords Input */}
            <div className="form-section">
              <label>Keywords</label>
              <div className="keywords-input">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add keyword..."
                  onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                />
                <button type="button" onClick={addKeyword} className="add-btn">Add</button>
              </div>
              <div className="keywords-list">
                {formData.keywords?.map(keyword => (
                  <span key={keyword} className="keyword-tag">
                    {keyword}
                    <button onClick={() => removeKeyword(keyword)}>×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Sources Selection */}
            <div className="form-section">
              <label>Sources</label>
              <div className="sources-grid">
                {sources.slice(0, 15).map(source => (
                  <label key={source} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.sources?.includes(source) || false}
                      onChange={() => toggleSource(source)}
                    />
                    <span className="checkbox-text">{source}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Mode Selection */}
            <div className="form-section">
              <label>Notification Mode</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="mode"
                    value="realtime"
                    checked={formData.mode === 'realtime'}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value as 'realtime' | 'daily' })}
                  />
                  <span>Real-time alerts</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="mode"
                    value="daily"
                    checked={formData.mode === 'daily'}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value as 'realtime' | 'daily' })}
                  />
                  <span>Daily digest</span>
                </label>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="form-section">
              <label>Notification Preferences</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.emailEnabled}
                    onChange={(e) => setFormData({ ...formData, emailEnabled: e.target.checked })}
                  />
                  <MdEmail />
                  <span>Email notifications</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.pushEnabled}
                    onChange={(e) => setFormData({ ...formData, pushEnabled: e.target.checked })}
                  />
                  <MdPhoneAndroid />
                  <span>Push notifications</span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button 
                className="btn save-btn"
                onClick={handleCreateSubscription}
                disabled={saving}
              >
                <MdSave /> {saving ? "Creating..." : "Create Subscription"}
              </button>
              <button 
                className="btn cancel-btn"
                onClick={cancelCreating}
                disabled={saving}
              >
                <MdCancel /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Subscriptions List */}
        <div className="subscriptions-list">
          {subscriptions.length === 0 ? (
            <div className="empty-state">
              <MdNotificationsActive size={64} />
              <h3>No subscriptions yet</h3>
              <p>Create your first subscription to start receiving personalized article alerts</p>
            </div>
          ) : (
            subscriptions.map(subscription => (
              <div key={subscription._id} className="subscription-card">
                {editingId === subscription._id ? (
                  // Edit mode - similar form as create but with different actions
                  <div className="edit-form">
                    <h4>Edit Subscription</h4>
                    {/* ... similar form fields as create form ... */}
                    <div className="form-actions">
                      <button 
                        className="btn save-btn"
                        onClick={() => handleUpdateSubscription(subscription._id!)}
                        disabled={saving}
                      >
                        <MdSave /> {saving ? "Saving..." : "Save Changes"}
                      </button>
                      <button 
                        className="btn cancel-btn"
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        <MdCancel /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="subscription-view">
                    <div className="subscription-header">
                      <div className="subscription-info">
                        <h4>
                          {subscription.mode === 'realtime' ? '⚡ Real-time' : '📅 Daily Digest'} Subscription
                        </h4>
                        <div className="notification-badges">
                          {subscription.emailEnabled && <span className="badge email-badge"><MdEmail /> Email</span>}
                          {subscription.pushEnabled && <span className="badge push-badge"><MdPhoneAndroid /> Push</span>}
                        </div>
                      </div>
                      <div className="subscription-actions">
                        <button 
                          className="btn edit-btn"
                          onClick={() => startEditing(subscription)}
                          disabled={saving}
                        >
                          <MdEdit />
                        </button>
                        <button 
                          className="btn delete-btn"
                          onClick={() => handleDeleteSubscription(subscription._id!)}
                          disabled={saving}
                        >
                          <MdDelete />
                        </button>
                      </div>
                    </div>
                    
                    <div className="subscription-content">
                      {subscription.topics && subscription.topics.length > 0 && (
                        <div className="content-section">
                          <strong>Topics:</strong>
                          <div className="tags">
                            {subscription.topics.map(topic => (
                              <span key={topic} className="tag">{topic}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {subscription.keywords && subscription.keywords.length > 0 && (
                        <div className="content-section">
                          <strong>Keywords:</strong>
                          <div className="tags">
                            {subscription.keywords.map(keyword => (
                              <span key={keyword} className="tag keyword-tag">{keyword}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {subscription.sources && subscription.sources.length > 0 && (
                        <div className="content-section">
                          <strong>Sources:</strong>
                          <div className="tags">
                            {subscription.sources.map(source => (
                              <span key={source} className="tag source-tag">{source}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .subscriptions-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e5e7eb;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-icon {
          color: #3b82f6;
        }

        .header-content h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          color: #1f2937;
        }

        .header-content p {
          margin: 0;
          color: #6b7280;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .create-btn {
          background: #3b82f6;
          color: white;
        }

        .create-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .save-btn {
          background: #10b981;
          color: white;
        }

        .save-btn:hover:not(:disabled) {
          background: #059669;
        }

        .cancel-btn {
          background: #6b7280;
          color: white;
        }

        .cancel-btn:hover:not(:disabled) {
          background: #4b5563;
        }

        .edit-btn {
          background: #f59e0b;
          color: white;
          padding: 0.5rem;
        }

        .edit-btn:hover:not(:disabled) {
          background: #d97706;
        }

        .delete-btn {
          background: #ef4444;
          color: white;
          padding: 0.5rem;
        }

        .delete-btn:hover:not(:disabled) {
          background: #dc2626;
        }

        .subscription-form, .edit-form {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .subscription-form h3, .edit-form h4 {
          margin: 0 0 1.5rem 0;
          color: #1f2937;
        }

        .form-section {
          margin-bottom: 1.5rem;
        }

        .form-section label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #374151;
        }

        .topics-grid, .sources-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .checkbox-label:hover {
          background-color: #f3f4f6;
        }

        .checkbox-text {
          font-weight: normal;
          margin: 0;
        }

        .keywords-input {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .keywords-input input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
        }

        .add-btn {
          padding: 0.5rem 1rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          cursor: pointer;
        }

        .keywords-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .keyword-tag {
          background: #dbeafe;
          color: #1d4ed8;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .keyword-tag button {
          background: none;
          border: none;
          color: #1d4ed8;
          cursor: pointer;
          font-weight: bold;
        }

        .radio-group, .checkbox-group {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .radio-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 2rem;
        }

        .subscriptions-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #6b7280;
        }

        .empty-state h3 {
          margin: 1rem 0 0.5rem 0;
          color: #374151;
        }

        .subscription-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .subscription-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .subscription-info h4 {
          margin: 0 0 0.5rem 0;
          color: #1f2937;
        }

        .notification-badges {
          display: flex;
          gap: 0.5rem;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .email-badge {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .push-badge {
          background: #d1fae5;
          color: #065f46;
        }

        .subscription-actions {
          display: flex;
          gap: 0.5rem;
        }

        .subscription-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .content-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .content-section strong {
          color: #374151;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag {
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .tag {
          background: #f3f4f6;
          color: #374151;
        }

        .keyword-tag {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .source-tag {
          background: #fef3c7;
          color: #92400e;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 1rem;
        }

        .loading-spinner {
          width: 2rem;
          height: 2rem;
          border: 3px solid #f3f4f6;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .subscriptions-container {
            padding: 1rem;
          }

          .page-header {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }

          .topics-grid, .sources-grid {
            grid-template-columns: 1fr;
          }

          .subscription-header {
            flex-direction: column;
            gap: 1rem;
          }

          .form-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}