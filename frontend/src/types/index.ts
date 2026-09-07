export type RoleCode = 'G' | 'P' | 'R' | 'A';

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  mobile: string | null;
  roleCode: RoleCode;
  roleName: string;
  representativeId: number | null;
  designation: string | null;
  permissions: string[];
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details: Array<{ field: string; message: string }>;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

export type VisitorType = 'General Public' | 'Entity Employee' | 'Party Cadre' | 'Govt Staff' | 'Personal';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type RequestStatus =
  | 'REGISTERED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ASSIGNED'
  | 'WAITING'
  | 'MEETING'
  | 'RESOLVED'
  | 'CHECKED_OUT'
  | 'CANCELLED';

export interface Visitor {
  id: number;
  visitor_code: string;
  name: string;
  mobile: string;
  address: string | null;
  district: string | null;
  constituency: string | null;
  visitor_type: VisitorType | null;
  identity_type: string | null;
  identity_reference: string | null;
  photo_url: string | null;
  is_restricted: 0 | 1;
  created_at: string;
  updated_at: string;
  history?: VisitorRequestSummary[];
  previousVisits?: number;
  lastVisit?: VisitorRequestSummary | null;
}

export interface VisitorRequestSummary {
  id: number;
  request_code: string;
  purpose: string;
  status: RequestStatus;
  priority: Priority;
  requested_at: string;
  resolved_at: string | null;
  department_name?: string | null;
}

export interface GroupMember {
  id?: number;
  name: string;
  mobile?: string;
  identityType?: string;
  identityReference?: string;
  address?: string;
  photoUrl?: string;
}

export interface VisitorRequest {
  id: number;
  request_code: string;
  visitor_id: number;
  created_by: number;
  purpose: string;
  reason: string | null;
  grievance_category: string | null;
  person_to_meet: string | null;
  representative_id: number | null;
  department_id: number | null;
  group_size: number;
  status: RequestStatus;
  priority: Priority;
  rejection_reason: string | null;
  requested_at: string;
  approved_at: string | null;
  resolved_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  updated_at: string;
  visitor_code: string;
  visitor_name: string;
  visitor_mobile: string;
  district: string | null;
  constituency: string | null;
  visitor_type: VisitorType | null;
  photo_url: string | null;
  is_restricted: 0 | 1;
  department_name: string | null;
  representative_name: string | null;
  created_by_name: string | null;
  statusHistory?: StatusHistoryEntry[];
  groupMembers?: GroupMember[];
}

export interface StatusHistoryEntry {
  id: number;
  old_status: RequestStatus | null;
  new_status: RequestStatus;
  remarks: string | null;
  created_at: string;
  changed_by_name: string;
}

export interface Meeting {
  id: number;
  visitor_request_id: number;
  representative_id: number;
  started_at: string | null;
  ended_at: string | null;
  remarks: string | null;
  resolution: string | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
  request_code: string;
  purpose: string;
  request_status: RequestStatus;
  priority: Priority;
  visitor_id: number;
  visitor_code: string;
  visitor_name: string;
  visitor_mobile: string;
  representative_name: string;
}

export interface Representative {
  id: number;
  user_id: number;
  designation: string | null;
  is_active: 0 | 1;
  name: string;
  email: string | null;
  mobile: string | null;
}

export interface Department {
  id: number;
  name: string;
  is_active: 0 | 1;
  created_at?: string;
}

export interface VisitReason {
  id: number;
  visitor_type: VisitorType;
  reason: string;
  is_active: 0 | 1;
}

export interface UserAccount {
  id: number;
  name: string;
  email: string | null;
  mobile: string | null;
  is_active: 0 | 1;
  role_id: number;
  role_code: RoleCode;
  role_name: string;
  representative_id: number | null;
  designation: string | null;
  created_at: string;
  updated_at: string;
  temporaryPassword?: string;
}

export interface RestrictedEntry {
  id: number;
  visitor_id: number;
  reason: string;
  restricted_from: string;
  attempted_entries: number;
  is_active: 0 | 1;
  created_at: string;
  visitor_name: string;
  mobile: string;
  visitor_code: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface DashboardMetrics {
  today: {
    total: number;
    pending: number;
    approved: number;
    waiting: number;
    inMeeting: number;
    resolved: number;
    rejected: number;
  };
  allTime: {
    total: number;
    pending: number;
    approved: number;
    waiting: number;
    inMeeting: number;
    resolved: number;
    rejected: number;
  };
  byStatus: Record<string, number>;
}
