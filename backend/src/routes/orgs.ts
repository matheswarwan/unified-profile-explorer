import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { DataCloudClient } from '../services/DataCloudClient';
import {
  Org,
  OrgPublic,
  CreateOrgRequest,
  UpdateOrgRequest,
} from '../types';

const router = Router();

function encryptCredentials(clientId: string, clientSecret: string): string {
  const encKey = process.env.ENCRYPTION_KEY;
  if (!encKey) throw new Error('ENCRYPTION_KEY not set');
  const payload = JSON.stringify({ clientId, clientSecret });
  return CryptoJS.AES.encrypt(payload, encKey).toString();
}

function orgToPublic(org: Org): OrgPublic {
  return {
    id: org.id,
    display_name: org.display_name,
    client_name: org.client_name,
    instance_url: org.instance_url,
    tenant_id: org.tenant_id,
    notes: org.notes,
    created_at: org.created_at,
    last_tested_at: org.last_tested_at,
    last_tested_status: org.last_tested_status,
  };
}

// All routes require auth
router.use(requireAuth);

// GET /api/orgs
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<Org>(
      'SELECT * FROM orgs ORDER BY created_at DESC'
    );
    res.json(result.rows.map(orgToPublic));
  } catch (err) {
    console.error('[orgs] List error:', err);
    res.status(500).json({ error: 'Failed to list orgs' });
  }
});

// GET /api/orgs/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<Org>(
      'SELECT * FROM orgs WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }
    res.json(orgToPublic(result.rows[0]));
  } catch (err) {
    console.error('[orgs] Get error:', err);
    res.status(500).json({ error: 'Failed to get org' });
  }
});

// POST /api/orgs
router.post(
  '/',
  [
    body('display_name').trim().notEmpty(),
    body('client_name').trim().notEmpty(),
    body('instance_url').trim().isURL(),
    body('tenant_id').trim().notEmpty(),
    body('client_id').trim().notEmpty(),
    body('client_secret').trim().notEmpty(),
  ],
  async (req: Request<object, object, CreateOrgRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const {
      display_name,
      client_name,
      instance_url,
      tenant_id,
      client_id,
      client_secret,
      notes,
    } = req.body;

    try {
      const credentials_encrypted = encryptCredentials(client_id, client_secret);
      const id = uuidv4();

      const result = await pool.query<Org>(
        `INSERT INTO orgs (
          id, display_name, client_name, instance_url, tenant_id,
          credentials_encrypted, notes, created_at, last_tested_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'untested')
        RETURNING *`,
        [id, display_name, client_name, instance_url, tenant_id, credentials_encrypted, notes ?? null]
      );

      res.status(201).json(orgToPublic(result.rows[0]));
    } catch (err) {
      console.error('[orgs] Create error:', err);
      res.status(500).json({ error: 'Failed to create org' });
    }
  }
);

// PUT /api/orgs/:id
router.put(
  '/:id',
  async (req: Request<{ id: string }, object, UpdateOrgRequest>, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;

    try {
      const existing = await pool.query<Org>('SELECT * FROM orgs WHERE id = $1', [id]);
      if (!existing.rows[0]) {
        res.status(404).json({ error: 'Org not found' });
        return;
      }

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramCount = 1;

      if (data.display_name !== undefined) {
        setClauses.push(`display_name = $${paramCount++}`);
        values.push(data.display_name);
      }
      if (data.client_name !== undefined) {
        setClauses.push(`client_name = $${paramCount++}`);
        values.push(data.client_name);
      }
      if (data.instance_url !== undefined) {
        setClauses.push(`instance_url = $${paramCount++}`);
        values.push(data.instance_url);
      }
      if (data.tenant_id !== undefined) {
        setClauses.push(`tenant_id = $${paramCount++}`);
        values.push(data.tenant_id);
      }
      if (data.notes !== undefined) {
        setClauses.push(`notes = $${paramCount++}`);
        values.push(data.notes);
      }
      if (data.client_id !== undefined && data.client_secret !== undefined) {
        const credentials_encrypted = encryptCredentials(data.client_id, data.client_secret);
        setClauses.push(`credentials_encrypted = $${paramCount++}`);
        values.push(credentials_encrypted);
      }

      if (setClauses.length === 0) {
        res.json(orgToPublic(existing.rows[0]));
        return;
      }

      values.push(id);
      const result = await pool.query<Org>(
        `UPDATE orgs SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      res.json(orgToPublic(result.rows[0]));
    } catch (err) {
      console.error('[orgs] Update error:', err);
      res.status(500).json({ error: 'Failed to update org' });
    }
  }
);

// DELETE /api/orgs/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM orgs WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }
    res.json({ message: 'Org deleted successfully' });
  } catch (err) {
    console.error('[orgs] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete org' });
  }
});

// POST /api/orgs/:id/test
router.post('/:id/test', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await pool.query<Org>('SELECT * FROM orgs WHERE id = $1', [id]);
    const org = result.rows[0];
    if (!org) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const client = new DataCloudClient(org);

    try {
      await client.getToken();

      // Update last_tested_at and status
      await pool.query(
        `UPDATE orgs SET last_tested_at = NOW(), last_tested_status = 'success' WHERE id = $1`,
        [id]
      );

      res.json({ success: true, message: 'Connection successful' });
    } catch (connErr) {
      await pool.query(
        `UPDATE orgs SET last_tested_at = NOW(), last_tested_status = 'failed' WHERE id = $1`,
        [id]
      );
      const errMsg = connErr instanceof Error ? connErr.message : 'Unknown error';
      res.status(400).json({ success: false, message: `Connection failed: ${errMsg}` });
    }
  } catch (err) {
    console.error('[orgs] Test error:', err);
    res.status(500).json({ error: 'Connection test failed' });
  }
});

export default router;
