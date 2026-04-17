import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { DataCloudClient } from '../services/DataCloudClient';
import { ProfileAssembler } from '../services/ProfileAssembler';
import { Org, LookupSearchRequest, LookupProfileRequest } from '../types';

const router = Router();

router.use(requireAuth);

// POST /api/lookup/search
router.post(
  '/search',
  [
    body('orgId').isUUID(),
    body('searchType').isIn(['email', 'name', 'phone']),
    body('searchValue').trim().notEmpty(),
  ],
  async (req: Request<object, object, LookupSearchRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { orgId, searchType, searchValue } = req.body;

    try {
      const orgResult = await pool.query<Org>('SELECT * FROM orgs WHERE id = $1', [orgId]);
      const org = orgResult.rows[0];
      if (!org) {
        res.status(404).json({ error: 'Org not found' });
        return;
      }

      const client = new DataCloudClient(org);
      const candidates = await client.resolveIndividual(searchType, searchValue);

      if (candidates.length === 0) {
        res.json({
          candidates: [],
          query: { orgId, searchType, searchValue },
          message: `No results found for ${searchType}: ${searchValue}`,
        });
        return;
      }

      res.json({ candidates, query: { orgId, searchType, searchValue } });
    } catch (err) {
      console.error('[lookup] Search error:', err);
      const errMsg = err instanceof Error ? err.message : 'Search failed';
      res.status(500).json({ error: errMsg });
    }
  }
);

// POST /api/lookup/profile
router.post(
  '/profile',
  [
    body('orgId').isUUID(),
    body('individualId').trim().notEmpty(),
  ],
  async (req: Request<object, object, LookupProfileRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { orgId, individualId } = req.body;

    try {
      const orgResult = await pool.query<Org>(
        'SELECT id FROM orgs WHERE id = $1',
        [orgId]
      );
      if (!orgResult.rows[0]) {
        res.status(404).json({ error: 'Org not found' });
        return;
      }

      const assembler = new ProfileAssembler(orgId);
      const profile = await assembler.assemble(individualId);

      res.json({ individualId, orgId, profile });
    } catch (err) {
      console.error('[lookup] Profile error:', err);
      const errMsg = err instanceof Error ? err.message : 'Profile assembly failed';
      res.status(500).json({ error: errMsg });
    }
  }
);

export default router;
