const { calculateSourceScore } = require('../services/sourceScoring.service');

describe('calculateSourceScore', () => {
  // Test "Good" (High Trust/Valid) URLs
  describe('High Scoring Sources', () => {
    const goodUrls = [
      ['https://www.google.com', 20],
      ['https://wikipedia.org', 20],
      ['https://www.who.int/', 70],
      ['https://european-union.europa.eu/index_en', 40],
      ['https://edu.mit.edu', 50],
    ];

    test.each(goodUrls)('returns high score for %s', (url, expected) => {
      const score = calculateSourceScore(url);
      expect(score).toEqual(expected);
    });
  });

  // Test "Bad" (Low Trust/Malformed) URLs
  describe('Low Scoring or Invalid Sources', () => {
    const badUrls = [
      ['http://malicious-site.net', 0],
      ['ftp://unsecured-server.com', 0],
      ['http://fake-news.net', 0], // flagged domain
      ['https://fake-news.net', 5], // flagged domain with https
    ];

    test.each(badUrls)('returns low or zero score for %s', (url, maxExpected) => {
      const score = calculateSourceScore(url);
      expect(score).toEqual(maxExpected );
    });
  });
});
