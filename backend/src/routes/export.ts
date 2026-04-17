import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { AnnotationStore } from '../services/AnnotationStore';
import { Annotation } from '../types';

const router = Router();
const store = new AnnotationStore();

router.use(requireAuth);

async function getOrgDisplayName(orgId: string): Promise<string> {
  const result = await pool.query<{ display_name: string; client_name: string }>(
    'SELECT display_name, client_name FROM orgs WHERE id = $1',
    [orgId]
  );
  if (!result.rows[0]) return orgId;
  return `${result.rows[0].client_name} — ${result.rows[0].display_name}`;
}

function annotationToMarkdown(ann: Annotation & { creator_name?: string }): string {
  const lines: string[] = [];

  lines.push(`### ${ann.annotation_type.toUpperCase()} — ${ann.id}`);
  lines.push('');

  if (ann.annotation_type === 'edge') {
    lines.push(`**Source DMO:** \`${ann.source_dmo ?? 'N/A'}\``);
    lines.push(`**Target DMO:** \`${ann.target_dmo ?? 'N/A'}\``);
    if (ann.source_field) lines.push(`**Source Field:** \`${ann.source_field}\``);
    if (ann.target_field) lines.push(`**Target Field:** \`${ann.target_field}\``);
    if (ann.join_type) lines.push(`**Join Type:** ${ann.join_type}`);
  } else if (ann.annotation_type === 'node_note') {
    lines.push(`**DMO:** \`${ann.source_dmo ?? 'N/A'}\``);
  } else if (ann.annotation_type === 'gap_flag') {
    lines.push(`**DMO:** \`${ann.source_dmo ?? 'N/A'}\``);
    if (ann.severity) lines.push(`**Severity:** ${ann.severity}`);
  }

  lines.push(`**Status:** ${ann.status}`);
  if (ann.is_reusable_pattern) lines.push(`**Reusable Pattern:** Yes`);
  if (ann.rationale) lines.push(`\n**Rationale:**\n${ann.rationale}`);
  if (ann.pattern_description) lines.push(`\n**Pattern Description:**\n${ann.pattern_description}`);

  lines.push('');
  lines.push(
    `*Created by ${ann.creator_name ?? 'Unknown'} on ${new Date(ann.created_at).toISOString().split('T')[0]}*`
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

// GET /api/export/:orgId/json
router.get('/:orgId/json', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;

  try {
    const orgCheck = await pool.query('SELECT id, display_name, client_name FROM orgs WHERE id = $1', [orgId]);
    if (!orgCheck.rows[0]) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const annotations = await store.getByOrg(orgId);

    const exportData = {
      exportedAt: new Date().toISOString(),
      org: orgCheck.rows[0],
      annotationCount: annotations.length,
      annotations,
    };

    const filename = `annotations-${orgCheck.rows[0].client_name}-${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);
  } catch (err) {
    console.error('[export] JSON error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/export/:orgId/markdown
router.get('/:orgId/markdown', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;

  try {
    const orgCheck = await pool.query<{ display_name: string; client_name: string }>(
      'SELECT id, display_name, client_name FROM orgs WHERE id = $1',
      [orgId]
    );
    if (!orgCheck.rows[0]) {
      res.status(404).json({ error: 'Org not found' });
      return;
    }

    const org = orgCheck.rows[0];
    const annotations = await store.getByOrg(orgId) as (Annotation & { creator_name?: string })[];

    const lines: string[] = [];
    lines.push(`# Data Model Annotations`);
    lines.push(`## ${org.client_name} — ${org.display_name}`);
    lines.push('');
    lines.push(`*Exported: ${new Date().toISOString()}*`);
    lines.push(`*Total annotations: ${annotations.length}*`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Group by type
    const byType: Record<string, (Annotation & { creator_name?: string })[]> = {
      edge: [],
      node_note: [],
      gap_flag: [],
      pattern: [],
    };

    for (const ann of annotations) {
      if (byType[ann.annotation_type]) {
        byType[ann.annotation_type].push(ann);
      }
    }

    if (byType.edge.length > 0) {
      lines.push('## Team-Defined Edges');
      lines.push('');
      for (const ann of byType.edge) {
        lines.push(annotationToMarkdown(ann));
      }
    }

    if (byType.node_note.length > 0) {
      lines.push('## Node Notes');
      lines.push('');
      for (const ann of byType.node_note) {
        lines.push(annotationToMarkdown(ann));
      }
    }

    if (byType.gap_flag.length > 0) {
      lines.push('## Gap Flags');
      lines.push('');
      for (const ann of byType.gap_flag) {
        lines.push(annotationToMarkdown(ann));
      }
    }

    if (byType.pattern.length > 0) {
      lines.push('## Reusable Patterns');
      lines.push('');
      for (const ann of byType.pattern) {
        lines.push(annotationToMarkdown(ann));
      }
    }

    const markdown = lines.join('\n');
    const filename = `annotations-${org.client_name}-${Date.now()}.md`;

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(markdown);
  } catch (err) {
    console.error('[export] Markdown error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
