import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { esClient, ES_INDEX } from '../config/es';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { q, limit = '20', offset = '0' } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // ES v8 SDK: query params go directly inline (no 'body' wrapper)
    const response = await esClient.search({
      index: ES_INDEX,
      from: parseInt(offset as string, 10) || 0,
      size: parseInt(limit as string, 10) || 20,
      query: {
        bool: {
          must: [
            { term: { userId } },
            {
              multi_match: {
                query: q,
                fields: ['subject', 'body', 'recipientEmail', 'senderEmail'],
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const hits = response.hits.hits.map((h: any) => ({
      _id: h._id,
      score: h._score,
      ...h._source,
    }));

    const total = response.hits.total;
    res.json({
      total: typeof total === 'number' ? total : total?.value ?? 0,
      results: hits,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to execute search' });
  }
});

export default router;
