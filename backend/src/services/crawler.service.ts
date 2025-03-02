import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { URL } from 'url';

export interface ArticleData {
    url: string;
    title: string;
    content: string;
    source: string;
}

const RETRY_DELAY_MS = 2000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchDynamicArticle = async (url: string): Promise<ArticleData> => {
    // Use the new headless mode for Chrome.
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
    );
    await page.goto(url, { waitUntil: 'networkidle2' });
    const html = await page.content();
    const $ = cheerio.load(html);
    const title = $('title').text().trim() || 'Untitled';
    const content = $('body').text().trim() || '';
    await browser.close();
    return { url, title, content, source: url };
};

export const fetchStaticArticle = async (url: string, retries = 3): Promise<ArticleData> => {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        const $ = cheerio.load(data);
        const title = $('title').text().trim() || 'Untitled';
        const content = $('body').text().trim() || '';
        return { url, title, content, source: url };
    } catch (error: any) {
        // Retry on ECONNRESET errors.
        if (retries > 0 && error.code === 'ECONNRESET') {
            console.warn(`ECONNRESET for ${url}. Retrying in ${RETRY_DELAY_MS}ms... (${retries} retries left)`);
            await delay(RETRY_DELAY_MS);
            return fetchStaticArticle(url, retries - 1);
        } else if (axios.isAxiosError(error) && error.response && error.response.status === 403) {
            console.warn(`Static fetch for ${url} returned 403. Falling back to dynamic fetch...`);
            return await fetchDynamicArticle(url);
        }
        throw error;
    }
};

/**
 * Crawls the homepage to extract up to `maxLinks` article URLs.
 */
export const crawlArticlesFromHomepage = async (homepageUrl: string, maxLinks: number = 20): Promise<string[]> => {
    try {
        const { data } = await axios.get(homepageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });
        const $ = cheerio.load(data);
        const links: string[] = [];
        const homepageHostname = new URL(homepageUrl).hostname;
        $('a').each((_, elem) => {
            let link = $(elem).attr('href');
            if (link) {
                try {
                    // Convert relative URL to absolute
                    link = new URL(link, homepageUrl).href;
                    // Only include links on the same domain and not the homepage itself.
                    if (link !== homepageUrl && link.includes(homepageHostname)) {
                        links.push(link);
                    }
                } catch (e) {
                    // Ignore invalid URLs.
                }
            }
        });
        // Deduplicate and limit to maxLinks.
        const uniqueLinks = Array.from(new Set(links)).slice(0, maxLinks);
        return uniqueLinks;
    } catch (error) {
        console.error(`Error crawling homepage ${homepageUrl}:`, error);
        return [];
    }
};
