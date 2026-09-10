import { api } from './api';
import type { ApiSuccess, GroupMember, PaginatedResult, Priority, Visitor, VisitorType } from '../types';

export interface VisitorListQuery {
  page?: number;
  limit?: number;
  search?: string;
  restricted?: boolean;
}

export interface RegisterVisitorPayload {
  visitorId?: number;
  name: string;
  mobile: string;
  address?: string;
  district?: string;
  constituency?: string;
  visitorType?: VisitorType;
  identityType?: string;
  identityReference?: string;
  photoUrl?: string;
  purpose: string;
  reason?: string;
  grievanceCategory?: string;
  personToMeet?: string;
  priority?: Priority;
  groupSize?: number;
  groupMembers?: GroupMember[];
}

export interface RegisterVisitorResult {
  visitorId: number;
  visitorCode: string;
  requestId: number;
  requestCode: string;
  status: string;
}

async function list(query: VisitorListQuery): Promise<PaginatedResult<Visitor>> {
  const { data } = await api.get<ApiSuccess<PaginatedResult<Visitor>>>('/visitors', { params: query });
  return data.data;
}

async function getById(id: number): Promise<Visitor> {
  const { data } = await api.get<ApiSuccess<Visitor>>(`/visitors/${id}`);
  return data.data;
}

async function register(payload: RegisterVisitorPayload): Promise<RegisterVisitorResult> {
  const { data } = await api.post<ApiSuccess<RegisterVisitorResult>>('/visitors', payload);
  return data.data;
}

async function update(id: number, payload: Partial<RegisterVisitorPayload>): Promise<Visitor> {
  const { data } = await api.put<ApiSuccess<Visitor>>(`/visitors/${id}`, payload);
  return data.data;
}

async function lookupByMobile(mobile: string): Promise<Visitor> {
  const { data } = await api.get<ApiSuccess<Visitor>>('/visitors/lookup', { params: { mobile } });
  return data.data;
}

export const visitorService = { list, getById, register, update, lookupByMobile };
