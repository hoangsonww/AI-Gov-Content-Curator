const googleAiKeys = [
  process.env.GOOGLE_AI_API_KEY,
  process.env.GOOGLE_AI_API_KEY1,
  process.env.GOOGLE_AI_API_KEY2,
  process.env.GOOGLE_AI_API_KEY3,
].filter(Boolean);

if (!googleAiKeys.length) {
  process.env.GOOGLE_AI_API_KEY = "dummy";
}
