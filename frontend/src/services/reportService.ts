import { api } from './api';
import type { ApiSuccess, PaginatedResult } from '../types';

export interface ReportQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  representative?: number;
  dateFrom?: string;
  dateTo?: string;
}

async function visitors(query: ReportQuery): Promise<PaginatedResult<Record<string, unknown>>> {
  const { data } = await api.get<ApiSuccess<PaginatedResult<Record<string, unknown>>>>('/reports/visitors', {
    params: query,
  });
  return data.data;
}

async function requests(query: ReportQuery): Promise<Array<Record<string, unknown>>> {
  const { data } = await api.get<ApiSuccess<Array<Record<string, unknown>>>>('/reports/requests', { params: query });
  return data.data;
}

async function meetings(query: ReportQuery): Promise<PaginatedResult<Record<string, unknown>>> {
  const { data } = await api.get<ApiSuccess<PaginatedResult<Record<string, unknown>>>>('/reports/meetings', {
    params: query,
  });
  return data.data;
}

async function representatives(query: ReportQuery): Promise<Array<Record<string, unknown>>> {
  const { data } = await api.get<ApiSuccess<Array<Record<string, unknown>>>>('/reports/representatives', {
    params: query,
  });
  return data.data;
}

async function trends(days = 14): Promise<Array<{ day: string; total: number }>> {
  const { data } = await api.get<ApiSuccess<Array<{ day: string; total: number }>>>('/reports/trends', {
    params: { days },
  });
  return data.data;
}

function downloadUrl(report: 'visitors' | 'requests' | 'meetings' | 'representatives', query: ReportQuery = {}) {
  const params = new URLSearchParams({ ...toStringRecord(query), format: 'csv' });
  return `${api.defaults.baseURL}/reports/${report}?${params.toString()}`;
}

function toStringRecord(query: ReportQuery): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') result[key] = String(value);
  }
  return result;
}

export const reportService = { visitors, requests, meetings, representatives, trends, downloadUrl };
