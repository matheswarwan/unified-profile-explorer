import pool from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import {
  Annotation,
  AnnotationHistory,
  AnnotationComment,
  CreateAnnotationRequest,
  UpdateAnnotationRequest,
} from '../types';

function buildChangeSummary(
  previous: Annotation,
  updated: Partial<Annotation>
): string {
  const changes: string[] = [];

  const fields: (keyof Annotation)[] = [
    'annotation_type',
    'source_dmo',
    'target_dmo',
    'source_field',
    'target_field',
    'join_type',
    'rationale',
    'status',
    'is_reusable_pattern',
    'pattern_description',
    'severity',
  ];

  for (const field of fields) {
    if (field in updated && updated[field] !== previous[field]) {
      changes.push(`${field}: "${String(previous[field])}" → "${String(updated[field])}"`);
    }
  }

  return changes.length > 0 ? changes.join('; ') : 'No changes';
}

export class AnnotationStore {
  async create(
    data: CreateAnnotationRequest,
    userId: string
  ): Promise<Annotation> {
    const result = await pool.query<Annotation>(
      `INSERT INTO annotations (
        id, org_id, annotation_type, source_dmo, target_dmo,
        source_field, target_field, join_type, rationale, status,
        is_reusable_pattern, pattern_description, severity, created_by,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, NOW(), NOW()
      ) RETURNING *`,
      [
        uuidv4(),
        data.org_id,
        data.annotation_type,
        data.source_dmo ?? null,
        data.target_dmo ?? null,
        data.source_field ?? null,
        data.target_field ?? null,
        data.join_type ?? null,
        data.rationale ?? null,
        data.status ?? 'proposed',
        data.is_reusable_pattern ?? false,
        data.pattern_description ?? null,
        data.severity ?? null,
        userId,
      ]
    );

    return result.rows[0];
  }

  async update(
    id: string,
    data: UpdateAnnotationRequest,
    userId: string
  ): Promise<Annotation> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Annotation ${id} not found`);

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    const fields: (keyof UpdateAnnotationRequest)[] = [
      'annotation_type',
      'source_dmo',
      'target_dmo',
      'source_field',
      'target_field',
      'join_type',
      'rationale',
      'status',
      'is_reusable_pattern',
      'pattern_description',
      'severity',
    ];

    for (const field of fields) {
      if (field in data) {
        setClauses.push(`${field} = $${paramCount}`);
        values.push(data[field] ?? null);
        paramCount++;
      }
    }

    setClauses.push(`updated_at = NOW()`);

    if (setClauses.length === 1) {
      // Only updated_at changed
      return existing;
    }

    values.push(id);

    const result = await pool.query<Annotation>(
      `UPDATE annotations SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    const updated = result.rows[0];

    // Log history
    const changeSummary = buildChangeSummary(existing, data as Partial<Annotation>);
    await this.logHistory(id, userId, existing, changeSummary);

    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Annotation ${id} not found`);

    // Log history before deletion
    await this.logHistory(id, userId, existing, 'Annotation deleted');

    await pool.query('DELETE FROM annotations WHERE id = $1', [id]);
  }

  async getById(id: string): Promise<Annotation | null> {
    const result = await pool.query<Annotation>(
      'SELECT * FROM annotations WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  async getByOrg(orgId: string): Promise<Annotation[]> {
    const result = await pool.query<Annotation>(
      `SELECT a.*, u.name as creator_name, u.email as creator_email
       FROM annotations a
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.org_id = $1
       ORDER BY a.created_at DESC`,
      [orgId]
    );
    return result.rows;
  }

  async getPatterns(): Promise<Annotation[]> {
    const result = await pool.query<Annotation>(
      `SELECT a.*, u.name as creator_name, u.email as creator_email,
              o.display_name as org_display_name, o.client_name
       FROM annotations a
       LEFT JOIN users u ON a.created_by = u.id
       LEFT JOIN orgs o ON a.org_id = o.id
       WHERE a.is_reusable_pattern = TRUE
         AND a.status != 'deprecated'
       ORDER BY a.created_at DESC`
    );
    return result.rows;
  }

  async getHistory(annotationId: string): Promise<AnnotationHistory[]> {
    const result = await pool.query<AnnotationHistory>(
      `SELECT ah.*, u.name as changed_by_name
       FROM annotation_history ah
       LEFT JOIN users u ON ah.changed_by = u.id
       WHERE ah.annotation_id = $1
       ORDER BY ah.changed_at DESC`,
      [annotationId]
    );
    return result.rows;
  }

  async getComments(annotationId: string): Promise<AnnotationComment[]> {
    const result = await pool.query<AnnotationComment>(
      `SELECT ac.*, u.name as author_name, u.email as author_email
       FROM annotation_comments ac
       LEFT JOIN users u ON ac.author_id = u.id
       WHERE ac.annotation_id = $1
       ORDER BY ac.created_at ASC`,
      [annotationId]
    );
    return result.rows;
  }

  async addComment(
    annotationId: string,
    userId: string,
    body: string
  ): Promise<AnnotationComment> {
    const result = await pool.query<AnnotationComment>(
      `INSERT INTO annotation_comments (id, annotation_id, author_id, body, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [uuidv4(), annotationId, userId, body]
    );
    return result.rows[0];
  }

  private async logHistory(
    annotationId: string,
    userId: string,
    previousValue: Annotation,
    changeSummary: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO annotation_history (id, annotation_id, changed_by, changed_at, previous_value_json, change_summary)
       VALUES ($1, $2, $3, NOW(), $4, $5)`,
      [
        uuidv4(),
        annotationId,
        userId,
        JSON.stringify(previousValue),
        changeSummary,
      ]
    );
  }
}
