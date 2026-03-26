interface WelcomeScreenProps {
  onNext: () => void;
  onSkip: () => void;
}

const WelcomeScreen = ({ onNext, onSkip }: WelcomeScreenProps) => {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center gap-6">
      <h1 className="text-3xl font-bold">Welcome to Your Personalized Feed</h1>
      <p className="text-gray-600">
        Finish a quick onboarding quiz to tailor recommendations to your interests.
        It takes about 60 seconds and you can skip anytime.
      </p>
      <button
        onClick={onNext}
        className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
      >
        Get Started
      </button>
      <button
        onClick={onSkip}
        className="text-sm text-gray-500 hover:text-gray-800"
      >
        Skip for Now
      </button>
    </div>
  );
};

export default WelcomeScreen;