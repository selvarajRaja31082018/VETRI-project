import { api } from './api';
import type { ApiSuccess, RestrictedEntry } from '../types';

async function list(): Promise<RestrictedEntry[]> {
  const { data } = await api.get<ApiSuccess<RestrictedEntry[]>>('/restricted-entries');
  return data.data;
}

async function restrict(visitorId: number, reason: string, restrictedFrom?: string): Promise<RestrictedEntry[]> {
  const { data } = await api.post<ApiSuccess<RestrictedEntry[]>>(`/restricted-entries/${visitorId}`, {
    reason,
    restrictedFrom,
  });
  return data.data;
}

async function recordAttempt(visitorId: number): Promise<void> {
  await api.post(`/restricted-entries/${visitorId}/attempt`);
}

async function release(visitorId: number): Promise<RestrictedEntry[]> {
  const { data } = await api.delete<ApiSuccess<RestrictedEntry[]>>(`/restricted-entries/${visitorId}`);
  return data.data;
}

export const restrictionService = { list, restrict, recordAttempt, release };
