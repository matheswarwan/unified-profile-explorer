import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// ============================================================
// Types (mirrored from backend)
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface OrgPublic {
  id: string;
  display_name: string;
  client_name: string;
  instance_url: string;
  tenant_id: string;
  notes: string | null;
  created_at: string;
  last_tested_at: string | null;
  last_tested_status: 'success' | 'failed' | 'untested';
}

export interface CreateOrgPayload {
  display_name: string;
  client_name: string;
  instance_url: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  notes?: string;
}

export interface UpdateOrgPayload {
  display_name?: string;
  client_name?: string;
  instance_url?: string;
  tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  notes?: string;
}

export interface IndividualCandidate {
  id: string;
  unifiedIndividualId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  confidence?: number;
}

export interface DmoField {
  name: string;
  label: string;
  type: string;
  nullable: boolean;
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

export interface ProfileResponse {
  individualId: string;
  orgId: string;
  profile: DmoProfileResult[];
}

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
  status?: string;
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

export interface GraphLayout {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
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
  created_at: string;
  updated_at: string;
  creator_name?: string;
  creator_email?: string;
  org_display_name?: string;
  client_name?: string;
}

export interface AnnotationComment {
  id: string;
  annotation_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name?: string;
  author_email?: string;
}

export interface CreateAnnotationPayload {
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

export interface UpdateAnnotationPayload {
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

// ============================================================
// Axios instance
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth-store');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// Auth API
// ============================================================

export const authApi = {
  register: async (email: string, name: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/register', { email, name, password });
    return res.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    return res.data;
  },
};

// ============================================================
// Orgs API
// ============================================================

export const orgsApi = {
  list: async (): Promise<OrgPublic[]> => {
    const res = await apiClient.get<OrgPublic[]>('/orgs');
    return res.data;
  },

  get: async (id: string): Promise<OrgPublic> => {
    const res = await apiClient.get<OrgPublic>(`/orgs/${id}`);
    return res.data;
  },

  create: async (data: CreateOrgPayload): Promise<OrgPublic> => {
    const res = await apiClient.post<OrgPublic>('/orgs', data);
    return res.data;
  },

  update: async (id: string, data: UpdateOrgPayload): Promise<OrgPublic> => {
    const res = await apiClient.put<OrgPublic>(`/orgs/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/orgs/${id}`);
  },

  testConnection: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post<{ success: boolean; message: string }>(`/orgs/${id}/test`);
    return res.data;
  },
};

// ============================================================
// Lookup API
// ============================================================

export const lookupApi = {
  search: async (
    orgId: string,
    searchType: 'email' | 'name' | 'phone',
    searchValue: string
  ): Promise<{ candidates: IndividualCandidate[]; query: object; message?: string }> => {
    const res = await apiClient.post('/lookup/search', { orgId, searchType, searchValue });
    return res.data;
  },

  profile: async (orgId: string, individualId: string): Promise<ProfileResponse> => {
    const res = await apiClient.post<ProfileResponse>('/lookup/profile', { orgId, individualId });
    return res.data;
  },
};

// ============================================================
// Schema API
// ============================================================

export const schemaApi = {
  getGraph: async (orgId: string): Promise<GraphLayout> => {
    const res = await apiClient.get<GraphLayout>(`/schema/${orgId}/graph`);
    return res.data;
  },

  refresh: async (orgId: string): Promise<{ message: string; nodeCount: number; edgeCount: number }> => {
    const res = await apiClient.post(`/schema/${orgId}/refresh`);
    return res.data;
  },

  saveLayout: async (orgId: string, layout_json: GraphLayout): Promise<void> => {
    await apiClient.post(`/schema/${orgId}/layout`, { layout_json });
  },
};

// ============================================================
// Annotations API
// ============================================================

export const annotationsApi = {
  list: async (orgId: string): Promise<Annotation[]> => {
    const res = await apiClient.get<Annotation[]>(`/annotations/${orgId}`);
    return res.data;
  },

  create: async (data: CreateAnnotationPayload): Promise<Annotation> => {
    const res = await apiClient.post<Annotation>('/annotations', data);
    return res.data;
  },

  update: async (id: string, data: UpdateAnnotationPayload): Promise<Annotation> => {
    const res = await apiClient.put<Annotation>(`/annotations/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/annotations/${id}`);
  },

  getComments: async (id: string): Promise<AnnotationComment[]> => {
    const res = await apiClient.get<AnnotationComment[]>(`/annotations/${id}/comments`);
    return res.data;
  },

  addComment: async (id: string, body: string): Promise<AnnotationComment> => {
    const res = await apiClient.post<AnnotationComment>(`/annotations/${id}/comments`, { body });
    return res.data;
  },

  getHistory: async (id: string): Promise<unknown[]> => {
    const res = await apiClient.get<unknown[]>(`/annotations/${id}/history`);
    return res.data;
  },
};

// ============================================================
// Patterns API
// ============================================================

export const patternsApi = {
  list: async (): Promise<Annotation[]> => {
    const res = await apiClient.get<Annotation[]>('/patterns');
    return res.data;
  },
};

// ============================================================
// Export API
// ============================================================

export const exportApi = {
  downloadJson: (orgId: string): string => {
    return `${API_BASE}/export/${orgId}/json`;
  },

  downloadMarkdown: (orgId: string): string => {
    return `${API_BASE}/export/${orgId}/markdown`;
  },
};

export default apiClient;
