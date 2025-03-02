import express from 'express';
import cors from 'cors';
import articleRoutes from './routes/article.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/articles', articleRoutes);

export default app;
