import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { SchemaBuilder } from '../services/SchemaBuilder';
import { ReactFlowLayout, SaveLayoutRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(requireAuth);

// GET /api/schema/:orgId/graph
router.get('/:orgId/graph', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;

  try {
    // Check org exists
    const orgCheck = await pool.query('SELECT id FROM orgs WHERE id = $1', [orgId]);
    if (!orgCheck.rows[0]) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const builder = new SchemaBuilder(orgId);
    const layout = await builder.getGraph();

    // Try to load saved user layout
    const userId = req.user!.id;
    const savedLayout = await pool.query<{ layout_json: ReactFlowLayout }>(
      'SELECT layout_json FROM graph_layouts WHERE org_id = $1 AND user_id = $2',
      [orgId, userId]
    );

    if (savedLayout.rows[0]) {
      // Merge saved positions with latest graph data
      const saved = savedLayout.rows[0].layout_json;
      const positionMap = new Map<string, { x: number; y: number }>();
      for (const node of saved.nodes || []) {
        positionMap.set(node.id, node.position);
      }

      const merged: ReactFlowLayout = {
        nodes: layout.nodes.map((node) => ({
          ...node,
          position: positionMap.get(node.id) || node.position,
        })),
        edges: layout.edges,
      };

      res.json(merged);
      return;
    }

    res.json(layout);
  } catch (err) {
    console.error('[schema] Get graph error:', err);
    const errMsg = err instanceof Error ? err.message : 'Failed to get schema graph';
    res.status(500).json({ error: errMsg });
  }
});

// POST /api/schema/:orgId/refresh
router.post('/:orgId/refresh', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;

  try {
    const orgCheck = await pool.query('SELECT id FROM orgs WHERE id = $1', [orgId]);
    if (!orgCheck.rows[0]) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const builder = new SchemaBuilder(orgId);
    await builder.clearCache();
    const layout = await builder.buildGraph();

    res.json({ message: 'Schema refreshed', nodeCount: layout.nodes.length, edgeCount: layout.edges.length });
  } catch (err) {
    console.error('[schema] Refresh error:', err);
    const errMsg = err instanceof Error ? err.message : 'Failed to refresh schema';
    res.status(500).json({ error: errMsg });
  }
});

// POST /api/schema/:orgId/layout — save user layout
router.post(
  '/:orgId/layout',
  [body('layout_json').isObject()],
  async (req: Request<{ orgId: string }, object, SaveLayoutRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { orgId } = req.params;
    const userId = req.user!.id;
    const { layout_json } = req.body;

    try {
      await pool.query(
        `INSERT INTO graph_layouts (id, org_id, user_id, layout_json, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (org_id, user_id)
         DO UPDATE SET layout_json = EXCLUDED.layout_json, updated_at = NOW()`,
        [uuidv4(), orgId, userId, JSON.stringify(layout_json)]
      );

      res.json({ message: 'Layout saved' });
    } catch (err) {
      console.error('[schema] Save layout error:', err);
      res.status(500).json({ error: 'Failed to save layout' });
    }
  }
);

export default router;
