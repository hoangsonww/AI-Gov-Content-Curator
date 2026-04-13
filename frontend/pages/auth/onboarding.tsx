'use client'

import React, { useState } from 'react';
import TopicSelection from '../../components/TopicSelection';
import SourceSelection from '../../components/SourceSelection';
import AlertsSetup from '../../components/AlertsSetup';
import PersonalizedFeed from '../../components/PersonalizedFeed';
import OnboardingStart from '../../components/OnboardingStart';
import { getTopics, getSources } from '../../services/api';

type AlertFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

const OnboardingQuiz = () => {
  const [step, setStep] = useState(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedFrequency, setSelectedFrequency] = useState<AlertFrequency>('daily');
  const [notifyOnNewStories, setNotifyOnNewStories] = useState(true);

  const [topics, setTopics] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  // Fallback hardcoded topics for later use or when API fails
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

  // Fallback hardcoded sources for later use or when API fails
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

  // Fetch topics from API
  const fetchTopics = async () => {
    try {
      const result = await getTopics("", 1, 100);
      if (result.data && result.data.length > 0) {
        setTopics(result.data);
      } else {
        // Fallback to hardcoded topics if API returns empty
        setTopics(getPlaceholderTopics());
      }
    } catch (error) {
      console.error("Failed to fetch topics from API", error);
      // Fallback to hardcoded topics
      setTopics(getPlaceholderTopics());
    }
  };

  // Fetch sources from API
  const fetchSources = async () => {
    try {
      const result = await getSources("", 1, 100);
      if (result.data && result.data.length > 0) {
        setSources(result.data);
      } else {
        // Fallback to hardcoded sources if API returns empty
        setSources(getPlaceholderSources());
      }
    } catch (error) {
      console.error("Failed to fetch sources from API", error);
      // Fallback to hardcoded sources
      setSources(getPlaceholderSources());
    }
  };

  React.useEffect(() => {
    fetchTopics();
    fetchSources();
  }, []);

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic) 
        : [...prev, topic]
    );
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source) 
        : [...prev, source]
    );
  };

  const updateFrequency = (frequency: AlertFrequency) => {
    setSelectedFrequency(frequency);
  };

  const updateNotifyOnNewStories = (notify: boolean) => {
    setNotifyOnNewStories(notify);
  };

  const deleteTopic = (topic: string) => {
    setSelectedTopics(prev => prev.filter(t => t !== topic));
  };

  const deleteSource = (source: string) => {
    setSelectedSources(prev => prev.filter(s => s !== source));
  };

  const goToTopicsStep = () => {
    setStep(2); // Go to topic selection step
  };

  const goToSourcesStep = () => {
    setStep(3); // Go to sources selection step
  };

  const goToAlertsStep = () => {
    setStep(4); // Go to alerts setup step
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);
  const skip = () => setStep(5); // Direct jump to feed

  return (
    <div className="onboarding-page">
      {/* Progress Bar (Visible on Screens 2-4) */}
      {step >= 2 && step <= 4 && (
        <div className="onboarding-progress-container">
          <div className="onboarding-progress-bar"
               style={{ width: `${(step - 1) * 33.3}%` }} />
        </div>
      )}

      {/* Screen Rendering */}
      <main className="onboarding-main-content">
        {step === 1 && <OnboardingStart onNext={nextStep} onSkip={skip} />}
        {step === 2 && <TopicSelection topics={topics} selectedTopics={selectedTopics} onToggle={toggleTopic} onNext={nextStep} onSkip={skip} />}
        {step === 3 && <SourceSelection sources={sources} selectedSources={selectedSources} onToggle={toggleSource} onNext={nextStep} onBack={prevStep} onSkip={skip} />}
        {step === 4 && <AlertsSetup selectedFrequency={selectedFrequency} notifyOnNewStories={notifyOnNewStories} onFrequencyChange={updateFrequency} onNotifyChange={updateNotifyOnNewStories} onNext={nextStep} onBack={prevStep} />}
        {step === 5 && <PersonalizedFeed selectedTopics={selectedTopics} selectedSources={selectedSources} selectedFrequency={selectedFrequency} notifyOnNewStories={notifyOnNewStories} onModifyTopics={goToTopicsStep} onModifySources={goToSourcesStep} onModifyAlerts={goToAlertsStep} onDeleteTopic={deleteTopic} onDeleteSource={deleteSource} />}
      </main>
    </div>
  );
};

export default OnboardingQuiz;