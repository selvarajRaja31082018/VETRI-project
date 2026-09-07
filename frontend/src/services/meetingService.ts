import { api } from './api';
import type { ApiSuccess, Meeting, PaginatedResult, Priority } from '../types';

export interface MeetingListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  today?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface CompleteMeetingPayload {
  remarks?: string;
  resolution?: string;
  grievanceCategory?: string;
  priority?: Priority;
  departmentId?: number;
  targetResolutionDate?: string;
  followUpDate?: string;
}

async function list(query: MeetingListQuery): Promise<PaginatedResult<Meeting>> {
  const { data } = await api.get<ApiSuccess<PaginatedResult<Meeting>>>('/meetings', { params: query });
  return data.data;
}

async function getById(id: number): Promise<Meeting> {
  const { data } = await api.get<ApiSuccess<Meeting>>(`/meetings/${id}`);
  return data.data;
}

async function start(visitorRequestId: number): Promise<Meeting> {
  const { data } = await api.post<ApiSuccess<Meeting>>('/meetings', { visitorRequestId });
  return data.data;
}

async function complete(id: number, payload: CompleteMeetingPayload): Promise<Meeting> {
  const { data } = await api.put<ApiSuccess<Meeting>>(`/meetings/${id}/complete`, payload);
  return data.data;
}

export const meetingService = { list, getById, start, complete };
