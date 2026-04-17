import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { AnnotationStore } from '../services/AnnotationStore';
import { CreateAnnotationRequest, UpdateAnnotationRequest } from '../types';

const router = Router();
const store = new AnnotationStore();

router.use(requireAuth);

// GET /api/annotations/:orgId
router.get('/:orgId', async (req: Request, res: Response): Promise<void> => {
  try {
    const annotations = await store.getByOrg(req.params.orgId);
    res.json(annotations);
  } catch (err) {
    console.error('[annotations] List error:', err);
    res.status(500).json({ error: 'Failed to list annotations' });
  }
});

// POST /api/annotations
router.post(
  '/',
  [
    body('org_id').isUUID(),
    body('annotation_type').isIn(['edge', 'node_note', 'gap_flag', 'pattern']),
    body('status').optional().isIn(['proposed', 'validated', 'deprecated']),
    body('severity').optional().isIn(['info', 'warning', 'blocker']),
    body('join_type').optional().isIn(['inner', 'left']),
  ],
  async (req: Request<object, object, CreateAnnotationRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const annotation = await store.create(req.body, req.user!.id);
      res.status(201).json(annotation);
    } catch (err) {
      console.error('[annotations] Create error:', err);
      res.status(500).json({ error: 'Failed to create annotation' });
    }
  }
);

// PUT /api/annotations/:id
router.put(
  '/:id',
  [
    body('status').optional().isIn(['proposed', 'validated', 'deprecated']),
    body('severity').optional().isIn(['info', 'warning', 'blocker']),
    body('join_type').optional().isIn(['inner', 'left']),
  ],
  async (req: Request<{ id: string }, object, UpdateAnnotationRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const annotation = await store.update(req.params.id, req.body, req.user!.id);
      res.json(annotation);
    } catch (err) {
      console.error('[annotations] Update error:', err);
      const errMsg = err instanceof Error ? err.message : 'Update failed';
      if (errMsg.includes('not found')) {
        res.status(404).json({ error: errMsg });
      } else {
        res.status(500).json({ error: errMsg });
      }
    }
  }
);

// DELETE /api/annotations/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await store.delete(req.params.id, req.user!.id);
    res.json({ message: 'Annotation deleted' });
  } catch (err) {
    console.error('[annotations] Delete error:', err);
    const errMsg = err instanceof Error ? err.message : 'Delete failed';
    if (errMsg.includes('not found')) {
      res.status(404).json({ error: errMsg });
    } else {
      res.status(500).json({ error: errMsg });
    }
  }
});

// GET /api/annotations/:id/comments
router.get('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const comments = await store.getComments(req.params.id);
    res.json(comments);
  } catch (err) {
    console.error('[annotations] Get comments error:', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// POST /api/annotations/:id/comments
router.post(
  '/:id/comments',
  [body('body').trim().notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      // Verify annotation exists
      const annotation = await store.getById(req.params.id);
      if (!annotation) {
        res.status(404).json({ error: 'Annotation not found' });
        return;
      }

      const comment = await store.addComment(req.params.id, req.user!.id, req.body.body);
      res.status(201).json(comment);
    } catch (err) {
      console.error('[annotations] Add comment error:', err);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  }
);

// GET /api/annotations/:id/history
router.get('/:id/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const history = await store.getHistory(req.params.id);
    res.json(history);
  } catch (err) {
    console.error('[annotations] Get history error:', err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

export default router;
