'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopicSelection from '../components/TopicSelection';
import SourceSelection from '../components/SourceSelection';
import AlertsSetup from '../components/AlertsSetup';
import PersonalizedFeed from '../components/PersonalizedFeed';
import { getTopics, getSources, getUserPreferences, setUserPreferences } from '../services/api';

type AlertFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'never';

const SettingsPage = () => {
  const router = useRouter();
  
  // Start directly at PersonalizedFeed (step 5)
  const [step, setStep] = useState(5);
  
  // State for preferences
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedFrequency, setSelectedFrequency] = useState<AlertFrequency>('daily');
  const [notifyOnNewStories, setNotifyOnNewStories] = useState(true);
  
  // State for available options
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  
  // State for loading
  const [loading, setLoading] = useState(true);

  const getPlaceholderTopics = (): string[] => {
    return [
      "Technology",
      "Politics",
      "Health",
      "Business",
      "Science",
      "Sports",
      "Entertainment",
      "Environment",
      "Education",
      "World",
    ];
  };

  const getPlaceholderSources = (): string[] => {
    return [
      "BBC",
      "CNN",
      "The White House",
      "Fox News",
      "The Guardian",
      "AP News"
    ];
  };

  // Load user preferences and available options on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        // Fetch user preferences, available topics, and available sources in parallel
        const [prefsResult, topicsResult, sourcesResult] = await Promise.all([
          getUserPreferences(token),
          getTopics("", 1, 100),
          getSources("", 1, 100)
        ]);

        // Set user preferences
        if (prefsResult) {
          const prefs = prefsResult;
          setSelectedTopics(prefs.topics || []);
          setSelectedSources(prefs.sources || []);
          setSelectedFrequency(prefs.alertFrequency || 'daily');
          setNotifyOnNewStories(prefs.notifyOnNewStories ?? true);
        }

        // Set available topics
        if (topicsResult && topicsResult.data && topicsResult.data.length > 0) {
          setAvailableTopics(topicsResult.data);
        } else {
          setAvailableTopics(getPlaceholderTopics());
        }

        // Set available sources
        if (sourcesResult && sourcesResult.data && sourcesResult.data.length > 0) {
          setAvailableSources(sourcesResult.data);
        } else {
          setAvailableSources(getPlaceholderSources());
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading preferences:', err);
        setAvailableTopics(getPlaceholderTopics());
        setAvailableSources(getPlaceholderSources());
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Topic management
  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic) 
        : [...prev, topic]
    );
  };

  const deleteTopic = (topic: string) => {
    setSelectedTopics(prev => prev.filter(t => t !== topic));
  };

  // Source management
  const toggleSource = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source) 
        : [...prev, source]
    );
  };

  const deleteSource = (source: string) => {
    setSelectedSources(prev => prev.filter(s => s !== source));
  };

  // Frequency update
  const updateFrequency = (frequency: AlertFrequency) => {
    setSelectedFrequency(frequency);
  };

  const updateNotifyOnNewStories = (notify: boolean) => {
    setNotifyOnNewStories(notify);
  };

  // Navigation
  const goToTopicsStep = () => setStep(2);
  const goToSourcesStep = () => setStep(3);
  const goToAlertsStep = () => setStep(4);
  const backToFeed = () => setStep(5);
  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  // Save preferences and return to feed
  const handleSaveAndContinue = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      const success = await setUserPreferences(token, {
        topics: selectedTopics,
        sources: selectedSources,
        alertFrequency: selectedFrequency,
        notifyOnNewStories: notifyOnNewStories,
      });

      if (success) {
        router.push('/home');
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
    }
  };

  if (loading) {
    return (
      <div className="onboarding-page">
        <main className="onboarding-main-content">
          <div className="onboarding-center">
            <p>Loading your preferences...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      {/* Progress Bar (Visible on edit steps 2-4) */}
      {step >= 2 && step <= 4 && (
        <div className="onboarding-progress-container">
          <div className="onboarding-progress-bar"
               style={{ width: `${(step - 1) * 33.3}%` }} />
        </div>
      )}

      <main className="onboarding-main-content">
        {step === 2 && (
          <TopicSelection 
            topics={availableTopics} 
            selectedTopics={selectedTopics} 
            onToggle={toggleTopic} 
            onNext={nextStep} 
            onSkip={backToFeed}
          />
        )}

        {step === 3 && (
          <SourceSelection 
            sources={availableSources} 
            selectedSources={selectedSources} 
            onToggle={toggleSource} 
            onNext={nextStep} 
            onBack={prevStep}
            onSkip={backToFeed}
          />
        )}

        {step === 4 && (
          <AlertsSetup 
            selectedFrequency={selectedFrequency} 
            notifyOnNewStories={notifyOnNewStories} 
            onFrequencyChange={updateFrequency} 
            onNotifyChange={updateNotifyOnNewStories} 
            onNext={handleSaveAndContinue} 
            onBack={prevStep}
          />
        )}

        {step === 5 && (
          <PersonalizedFeed 
            selectedTopics={selectedTopics}
            selectedSources={selectedSources}
            selectedFrequency={selectedFrequency}
            notifyOnNewStories={notifyOnNewStories}
            onModifyTopics={goToTopicsStep}
            onModifySources={goToSourcesStep}
            onModifyAlerts={goToAlertsStep}
            onDeleteTopic={deleteTopic}
            onDeleteSource={deleteSource}
          />
        )}
      </main>
    </div>
  );
};

export default SettingsPage;
