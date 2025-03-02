import axios from 'axios';
import { ArticleData } from './crawler.service';

export const fetchArticlesFromNewsAPI = async (): Promise<ArticleData[]> => {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
        throw new Error('Missing NEWS_API_KEY');
    }
    const url = `https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`;
    const response = await axios.get(url);
    const articles = response.data.articles;
    return articles.map((a: any) => ({
        url: a.url,
        title: a.title,
        content: a.content || a.description || '',
        source: a.source.name || 'NewsAPI'
    }));
};
