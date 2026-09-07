import { api } from './api';
import type { ApiSuccess, AuditLog, PaginatedResult } from '../types';

export interface AuditQuery {
  page?: number;
  limit?: number;
  userId?: number;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}

async function list(query: AuditQuery): Promise<PaginatedResult<AuditLog>> {
  const { data } = await api.get<ApiSuccess<PaginatedResult<AuditLog>>>('/audit-logs', { params: query });
  return data.data;
}

async function actions(): Promise<string[]> {
  const { data } = await api.get<ApiSuccess<string[]>>('/audit-logs/actions');
  return data.data;
}

export const auditService = { list, actions };
