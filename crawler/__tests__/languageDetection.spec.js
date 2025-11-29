/**
 * Tests for the language detection service.
 */

const mockFranc = jest.fn();
jest.mock("franc", () => ({
  franc: mockFranc,
}));

const {
  detectLanguage,
  getLanguageName,
  isEnglishCode,
} = require("../services/languageDetection.service");

describe("languageDetection.service", () => {
  beforeEach(() => {
    mockFranc.mockReset();
  });

  describe("detectLanguage", () => {
    it("should detect English text", () => {
      mockFranc.mockReturnValue("eng");

      const result = detectLanguage(
        "This is a test sentence in English that should be detected properly.",
      );

      expect(result).toEqual({
        code: "eng",
        name: "English",
        isEnglish: true,
      });
    });

    it("should detect Spanish text", () => {
      mockFranc.mockReturnValue("spa");

      const result = detectLanguage(
        "Esta es una oración de prueba en español que debería ser detectada correctamente.",
      );

      expect(result).toEqual({
        code: "spa",
        name: "Spanish",
        isEnglish: false,
      });
    });

    it("should detect French text", () => {
      mockFranc.mockReturnValue("fra");

      const result = detectLanguage(
        "Ceci est une phrase de test en français qui devrait être détectée correctement.",
      );

      expect(result).toEqual({
        code: "fra",
        name: "French",
        isEnglish: false,
      });
    });

    it("should return unknown for very short text", () => {
      const result = detectLanguage("Hi");

      expect(result).toEqual({
        code: "und",
        name: "Unknown",
        isEnglish: false,
      });
      expect(mockFranc).not.toHaveBeenCalled();
    });

    it("should return unknown for empty text", () => {
      const result = detectLanguage("");

      expect(result).toEqual({
        code: "und",
        name: "Unknown",
        isEnglish: false,
      });
      expect(mockFranc).not.toHaveBeenCalled();
    });

    it("should return unknown for null text", () => {
      const result = detectLanguage(null);

      expect(result).toEqual({
        code: "und",
        name: "Unknown",
        isEnglish: false,
      });
    });

    it("should handle undetermined language from franc", () => {
      mockFranc.mockReturnValue("und");

      const result = detectLanguage(
        "Mixed content with various symbols @#$%^&*",
      );

      expect(result).toEqual({
        code: "und",
        name: "Unknown",
        isEnglish: false,
      });
    });

    it("should handle unknown language codes", () => {
      mockFranc.mockReturnValue("xyz");

      const result = detectLanguage(
        "Some text in an unknown language code that franc returns",
      );

      expect(result).toEqual({
        code: "xyz",
        name: "xyz",
        isEnglish: false,
      });
    });
  });

  describe("getLanguageName", () => {
    it("should return correct name for known codes", () => {
      expect(getLanguageName("eng")).toBe("English");
      expect(getLanguageName("spa")).toBe("Spanish");
      expect(getLanguageName("fra")).toBe("French");
      expect(getLanguageName("deu")).toBe("German");
    });

    it("should return the code itself for unknown codes", () => {
      expect(getLanguageName("xyz")).toBe("xyz");
    });
  });

  describe("isEnglishCode", () => {
    it("should return true for English", () => {
      expect(isEnglishCode("eng")).toBe(true);
    });

    it("should return false for non-English codes", () => {
      expect(isEnglishCode("spa")).toBe(false);
      expect(isEnglishCode("fra")).toBe(false);
      expect(isEnglishCode("und")).toBe(false);
    });
  });
});
