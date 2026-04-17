import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import pool from '../db/connection';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { DataCloudClient } from '../services/DataCloudClient';
import { ProfileAssembler } from '../services/ProfileAssembler';
import { Org, LookupSearchRequest, LookupProfileRequest } from '../types';

const router = Router();

router.use(requireAuth);

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function writeAuditLog(
  userId: string,
  orgId: string,
  searchType: string,
  searchValue: string,
  individualIdHash: string | null,
  resultCount: number
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO lookup_audit_log
         (user_id, org_id, search_type, search_value_hash, individual_id_hash, result_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, orgId, searchType, sha256(searchValue), individualIdHash, resultCount]
    );
  } catch (err) {
    // Audit log failures must never block the main response
    console.error('[audit] Failed to write audit log:', err);
  }
}

// POST /api/lookup/search
router.post(
  '/search',
  [
    body('orgId').isUUID(),
    body('searchType').isIn(['email', 'name', 'phone']),
    body('searchValue').trim().notEmpty(),
  ],
  async (req: AuthRequest & Request<object, object, LookupSearchRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { orgId, searchType, searchValue } = req.body;
    const userId = req.user!.id;

    try {
      const orgResult = await pool.query<Org>('SELECT * FROM orgs WHERE id = $1', [orgId]);
      const org = orgResult.rows[0];
      if (!org) {
        res.status(404).json({ error: 'Org not found' });
        return;
      }

      const client = new DataCloudClient(org);
      const candidates = await client.resolveIndividual(searchType, searchValue);

      // Write audit log (fire-and-forget)
      const topIndividualHash = candidates[0]
        ? sha256(candidates[0].unifiedIndividualId)
        : null;
      void writeAuditLog(userId, orgId, searchType, searchValue, topIndividualHash, candidates.length);

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
  async (req: AuthRequest & Request<object, object, LookupProfileRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { orgId, individualId } = req.body;
    const userId = req.user!.id;

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

      // Audit log: hashed individual ID, profile DMO count as "result_count"
      void writeAuditLog(userId, orgId, 'profile', individualId, sha256(individualId), profile.length);

      res.json({ individualId, orgId, profile });
    } catch (err) {
      console.error('[lookup] Profile error:', err);
      const errMsg = err instanceof Error ? err.message : 'Profile assembly failed';
      res.status(500).json({ error: errMsg });
    }
  }
);

export default router;
