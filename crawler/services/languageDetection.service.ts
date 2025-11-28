import { franc } from "franc";

/**
 * Language detection result interface
 */
export interface LanguageDetectionResult {
  /** ISO 639-3 language code (e.g., 'eng', 'spa', 'fra') */
  code: string;
  /** Human-readable language name */
  name: string;
  /** Whether the detected language is English */
  isEnglish: boolean;
}

/**
 * Map of ISO 639-3 language codes to human-readable names
 */
const LANGUAGE_NAMES: Record<string, string> = {
  eng: "English",
  spa: "Spanish",
  fra: "French",
  deu: "German",
  ita: "Italian",
  por: "Portuguese",
  nld: "Dutch",
  rus: "Russian",
  zho: "Chinese",
  jpn: "Japanese",
  kor: "Korean",
  ara: "Arabic",
  hin: "Hindi",
  tur: "Turkish",
  pol: "Polish",
  ukr: "Ukrainian",
  vie: "Vietnamese",
  tha: "Thai",
  ind: "Indonesian",
  msa: "Malay",
  swe: "Swedish",
  nor: "Norwegian",
  dan: "Danish",
  fin: "Finnish",
  ces: "Czech",
  ell: "Greek",
  heb: "Hebrew",
  ron: "Romanian",
  hun: "Hungarian",
  bul: "Bulgarian",
  hrv: "Croatian",
  slk: "Slovak",
  slv: "Slovenian",
  srp: "Serbian",
  lit: "Lithuanian",
  lav: "Latvian",
  est: "Estonian",
  cat: "Catalan",
  eus: "Basque",
  glg: "Galician",
  afr: "Afrikaans",
  fil: "Filipino",
  und: "Unknown",
};

/**
 * Detect the language of the given text using franc library.
 *
 * @param text - The text content to analyze for language detection.
 * @returns The detected language information including code, name, and whether it's English.
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  // franc requires at least some text to work with
  if (!text || text.trim().length < 10) {
    return {
      code: "und",
      name: "Unknown",
      isEnglish: false,
    };
  }

  // Use franc for language detection
  // franc returns ISO 639-3 codes like 'eng', 'spa', 'fra', etc.
  const detectedCode = franc(text);

  // 'und' means undetermined/unknown
  if (detectedCode === "und") {
    return {
      code: "und",
      name: "Unknown",
      isEnglish: false,
    };
  }

  const languageName = LANGUAGE_NAMES[detectedCode] || detectedCode;
  const isEnglish = detectedCode === "eng";

  return {
    code: detectedCode,
    name: languageName,
    isEnglish,
  };
}

/**
 * Get the human-readable language name from an ISO 639-3 code.
 *
 * @param code - The ISO 639-3 language code.
 * @returns The human-readable language name.
 */
export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code;
}

/**
 * Check if a language code represents English.
 *
 * @param code - The ISO 639-3 language code.
 * @returns True if the code represents English.
 */
export function isEnglishCode(code: string): boolean {
  return code === "eng";
}
