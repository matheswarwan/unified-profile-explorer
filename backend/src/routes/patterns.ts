import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { AnnotationStore } from '../services/AnnotationStore';

const router = Router();
const store = new AnnotationStore();

router.use(requireAuth);

// GET /api/patterns — all reusable patterns across all orgs
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const patterns = await store.getPatterns();
    res.json(patterns);
  } catch (err) {
    console.error('[patterns] List error:', err);
    res.status(500).json({ error: 'Failed to list patterns' });
  }
});

export default router;
