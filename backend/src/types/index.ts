// ============================================================
// Database Model Types
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date;
  last_login_at: Date | null;
}

export interface Org {
  id: string;
  display_name: string;
  client_name: string;
  instance_url: string;
  tenant_id: string;
  credentials_encrypted: string;
  notes: string | null;
  created_at: Date;
  last_tested_at: Date | null;
  last_tested_status: 'success' | 'failed' | 'untested';
}

export interface DmoSchemaCache {
  id: string;
  org_id: string;
  dmo_api_name: string;
  schema_json: DmoSchema;
  record_count: number | null;
  cached_at: Date;
  ttl_minutes: number;
}

export interface GraphLayout {
  id: string;
  org_id: string;
  user_id: string;
  layout_json: ReactFlowLayout;
  updated_at: Date;
}

export type AnnotationType = 'edge' | 'node_note' | 'gap_flag' | 'pattern';
export type AnnotationStatus = 'proposed' | 'validated' | 'deprecated';
export type SeverityLevel = 'info' | 'warning' | 'blocker';

export interface Annotation {
  id: string;
  org_id: string;
  annotation_type: AnnotationType;
  source_dmo: string | null;
  target_dmo: string | null;
  source_field: string | null;
  target_field: string | null;
  join_type: 'inner' | 'left' | null;
  rationale: string | null;
  status: AnnotationStatus;
  is_reusable_pattern: boolean;
  pattern_description: string | null;
  severity: SeverityLevel | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface AnnotationHistory {
  id: string;
  annotation_id: string;
  changed_by: string;
  changed_at: Date;
  previous_value_json: Annotation;
  change_summary: string;
}

export interface AnnotationComment {
  id: string;
  annotation_id: string;
  author_id: string;
  body: string;
  created_at: Date;
}

// ============================================================
// Data Cloud / DMO Types
// ============================================================

export interface DmoField {
  name: string;
  label: string;
  type: string;
  nullable: boolean;
  isRelationship?: boolean;
  relationshipTarget?: string;
}

export interface DmoRelationship {
  targetDmo: string;
  sourceField: string;
  targetField: string;
  type?: string;
}

export interface DmoSchema {
  apiName: string;
  label: string;
  fields: DmoField[];
  relationships: DmoRelationship[];
  recordCount?: number;
  lastIngestionAt?: string | null;
}

export interface DataCloudCredentials {
  clientId: string;
  clientSecret: string;
}

export interface DataCloudTokenResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
  expires_in?: number;
}

export interface DataCloudQueryResponse {
  data: Record<string, unknown>[];
  metadata?: {
    count: number;
    queryId?: string;
  };
}

// ============================================================
// Graph Types
// ============================================================

export interface GraphNodeData {
  label: string;
  apiName: string;
  recordCount: number | null;
  status: 'reachable' | 'unreachable' | 'no-data';
  fields: DmoField[];
  lastIngestionAt?: string | null;
}

export interface GraphEdgeData {
  sourceField: string;
  targetField: string;
  joinType?: string;
  isAnnotated: boolean;
  annotationId?: string;
  rationale?: string;
  status?: AnnotationStatus;
  createdBy?: string;
  createdAt?: string;
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: GraphNodeData;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  animated?: boolean;
  style?: Record<string, unknown>;
  data: GraphEdgeData;
  label?: string;
}

export interface ReactFlowLayout {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

export interface AdjacencyNode {
  dmoApiName: string;
  label: string;
  edges: DmoRelationship[];
  annotatedEdges: AnnotationEdge[];
  recordCount?: number | null;
  reachable?: boolean;
  hasData?: boolean;
  fields?: DmoField[];
}

export interface AnnotationEdge {
  targetDmo: string;
  sourceField: string;
  targetField: string;
  joinType: string;
  annotationId: string;
  rationale: string | null;
  status: AnnotationStatus;
}

// ============================================================
// Profile Assembly Types
// ============================================================

export interface IndividualCandidate {
  id: string;
  unifiedIndividualId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  confidence?: number;
}

export interface DmoProfileResult {
  dmoName: string;
  displayName: string;
  fields: DmoField[];
  records: Record<string, unknown>[];
  source: 'native' | 'team-defined';
  error?: string;
  annotationId?: string;
}

// ============================================================
// API Request / Response Types
// ============================================================

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface CreateOrgRequest {
  display_name: string;
  client_name: string;
  instance_url: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  notes?: string;
}

export interface UpdateOrgRequest {
  display_name?: string;
  client_name?: string;
  instance_url?: string;
  tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  notes?: string;
}

export interface OrgPublic {
  id: string;
  display_name: string;
  client_name: string;
  instance_url: string;
  tenant_id: string;
  notes: string | null;
  created_at: Date;
  last_tested_at: Date | null;
  last_tested_status: 'success' | 'failed' | 'untested';
}

export interface LookupSearchRequest {
  orgId: string;
  searchType: 'email' | 'name' | 'phone';
  searchValue: string;
}

export interface LookupProfileRequest {
  orgId: string;
  individualId: string;
}

export interface CreateAnnotationRequest {
  org_id: string;
  annotation_type: AnnotationType;
  source_dmo?: string;
  target_dmo?: string;
  source_field?: string;
  target_field?: string;
  join_type?: 'inner' | 'left';
  rationale?: string;
  status?: AnnotationStatus;
  is_reusable_pattern?: boolean;
  pattern_description?: string;
  severity?: SeverityLevel;
}

export interface UpdateAnnotationRequest {
  annotation_type?: AnnotationType;
  source_dmo?: string;
  target_dmo?: string;
  source_field?: string;
  target_field?: string;
  join_type?: 'inner' | 'left';
  rationale?: string;
  status?: AnnotationStatus;
  is_reusable_pattern?: boolean;
  pattern_description?: string;
  severity?: SeverityLevel;
}

export interface AddCommentRequest {
  body: string;
}

export interface SaveLayoutRequest {
  layout_json: ReactFlowLayout;
}

// ============================================================
// Express augmentation
// ============================================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}
