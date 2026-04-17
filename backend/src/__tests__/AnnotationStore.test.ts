import { AnnotationStore } from '../services/AnnotationStore';
import { mockQuery } from '../__mocks__/db';
import { Annotation } from '../types';

jest.mock('../db/connection');

const mockAnnotation: Annotation = {
  id: 'ann-123',
  org_id: 'org-456',
  annotation_type: 'edge',
  source_dmo: 'ssot__Individual__dlm',
  target_dmo: 'Custom__dlm',
  source_field: 'ssot__Id__c',
  target_field: 'IndividualId__c',
  join_type: 'inner',
  rationale: 'Test rationale',
  status: 'proposed',
  is_reusable_pattern: false,
  pattern_description: null,
  severity: null,
  created_by: 'user-789',
  created_at: new Date(),
  updated_at: new Date(),
};

describe('AnnotationStore', () => {
  let store: AnnotationStore;

  beforeEach(() => {
    store = new AnnotationStore();
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('inserts a new annotation and returns it', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAnnotation] });

      const result = await store.create(
        {
          org_id: 'org-456',
          annotation_type: 'edge',
          source_dmo: 'ssot__Individual__dlm',
          target_dmo: 'Custom__dlm',
          source_field: 'ssot__Id__c',
          target_field: 'IndividualId__c',
          join_type: 'inner',
          rationale: 'Test rationale',
          status: 'proposed',
        },
        'user-789'
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO annotations');
      expect(result.source_dmo).toBe('ssot__Individual__dlm');
      expect(result.target_dmo).toBe('Custom__dlm');
    });

    it('defaults is_reusable_pattern to false and status to proposed', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAnnotation] });

      await store.create({ org_id: 'org-1', annotation_type: 'node_note' }, 'user-1');

      const callArgs = mockQuery.mock.calls[0][1] as unknown[];
      // is_reusable_pattern is param $11, status is param $10
      expect(callArgs[9]).toBe('proposed');
      expect(callArgs[10]).toBe(false);
    });
  });

  describe('update()', () => {
    it('updates annotation fields and logs history', async () => {
      // First call: getById
      mockQuery.mockResolvedValueOnce({ rows: [mockAnnotation] });
      // Second call: UPDATE
      const updated = { ...mockAnnotation, status: 'validated' as const };
      mockQuery.mockResolvedValueOnce({ rows: [updated] });
      // Third call: logHistory INSERT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await store.update('ann-123', { status: 'validated' }, 'user-789');

      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(result.status).toBe('validated');

      // History insert should contain annotation_history
      const historyCall = mockQuery.mock.calls[2][0] as string;
      expect(historyCall).toContain('annotation_history');
    });

    it('throws if annotation not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(store.update('nonexistent', { status: 'validated' }, 'user-1')).rejects.toThrow(
        'Annotation nonexistent not found'
      );
    });

    it('returns existing annotation if no fields changed', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAnnotation] });

      const result = await store.update('ann-123', {}, 'user-789');

      // Only the getById call should happen (no UPDATE, no history)
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAnnotation);
    });
  });

  describe('delete()', () => {
    it('logs history then deletes the annotation', async () => {
      // getById
      mockQuery.mockResolvedValueOnce({ rows: [mockAnnotation] });
      // logHistory
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // DELETE
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await store.delete('ann-123', 'user-789');

      expect(mockQuery).toHaveBeenCalledTimes(3);

      const deleteCall = mockQuery.mock.calls[2][0] as string;
      expect(deleteCall).toContain('DELETE FROM annotations');
      expect(mockQuery.mock.calls[2][1]).toEqual(['ann-123']);
    });

    it('throws if annotation not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(store.delete('nonexistent', 'user-1')).rejects.toThrow(
        'Annotation nonexistent not found'
      );
    });
  });

  describe('getByOrg()', () => {
    it('returns all annotations for an org with creator info', async () => {
      const rows = [mockAnnotation, { ...mockAnnotation, id: 'ann-999' }];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await store.getByOrg('org-456');

      expect(result).toHaveLength(2);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('LEFT JOIN users');
      expect(mockQuery.mock.calls[0][1]).toEqual(['org-456']);
    });
  });

  describe('getPatterns()', () => {
    it('returns only reusable patterns that are not deprecated', async () => {
      const patternAnnotation = { ...mockAnnotation, is_reusable_pattern: true };
      mockQuery.mockResolvedValueOnce({ rows: [patternAnnotation] });

      const result = await store.getPatterns();

      expect(result).toHaveLength(1);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('is_reusable_pattern = TRUE');
      expect(sql).toContain("status != 'deprecated'");
    });
  });

  describe('addComment()', () => {
    it('inserts a comment and returns it', async () => {
      const comment = {
        id: 'cmt-1',
        annotation_id: 'ann-123',
        author_id: 'user-789',
        body: 'Test comment',
        created_at: new Date().toISOString(),
      };
      mockQuery.mockResolvedValueOnce({ rows: [comment] });

      const result = await store.addComment('ann-123', 'user-789', 'Test comment');

      expect(result.body).toBe('Test comment');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('INSERT INTO annotation_comments');
    });
  });

  describe('getHistory()', () => {
    it('returns history ordered by changed_at DESC', async () => {
      const historyRow = {
        id: 'hist-1',
        annotation_id: 'ann-123',
        changed_by: 'user-789',
        changed_at: new Date().toISOString(),
        previous_value_json: mockAnnotation,
        change_summary: 'status: "proposed" → "validated"',
      };
      mockQuery.mockResolvedValueOnce({ rows: [historyRow] });

      const result = await store.getHistory('ann-123');

      expect(result).toHaveLength(1);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY ah.changed_at DESC');
    });
  });
});
