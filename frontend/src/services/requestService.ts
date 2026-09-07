import { api } from './api';
import type { ApiSuccess, DashboardMetrics, PaginatedResult, Priority, VisitorRequest } from '../types';

export interface RequestListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string | string[];
  priority?: Priority;
  representativeId?: number;
  departmentId?: number;
  dateFrom?: string;
  dateTo?: string;
  today?: boolean;
}

async function list(query: RequestListQuery): Promise<PaginatedResult<VisitorRequest>> {
  const { data } = await api.get<ApiSuccess<PaginatedResult<VisitorRequest>>>('/visitor-requests', {
    params: query,
  });
  return data.data;
}

async function getById(id: number): Promise<VisitorRequest> {
  const { data } = await api.get<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}`);
  return data.data;
}

async function dashboard(): Promise<DashboardMetrics> {
  const { data } = await api.get<ApiSuccess<DashboardMetrics>>('/visitor-requests/dashboard');
  return data.data;
}

async function approve(id: number, payload: { remarks?: string; representativeId?: number }) {
  const { data } = await api.put<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/approve`, payload);
  return data.data;
}

async function reject(id: number, reason: string) {
  const { data } = await api.put<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/reject`, { reason });
  return data.data;
}

async function assign(id: number, representativeId: number, remarks?: string) {
  const { data } = await api.put<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/assign`, {
    representativeId,
    remarks,
  });
  return data.data;
}

async function queue(id: number, remarks?: string) {
  const { data } = await api.put<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/queue`, { remarks });
  return data.data;
}

async function scheduleAppointment(id: number, appointmentDate: string) {
  const { data } = await api.put<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/schedule`, {
    appointmentDate,
  });
  return data.data;
}

async function resolve(id: number, resolution: string) {
  const { data } = await api.put<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/resolve`, { resolution });
  return data.data;
}

async function cancel(id: number, reason?: string) {
  const { data } = await api.put<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/cancel`, { reason });
  return data.data;
}

async function setPriority(id: number, priority: Priority) {
  const { data } = await api.put<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/priority`, { priority });
  return data.data;
}

async function referToDepartment(id: number, departmentId: number, remarks?: string) {
  const { data } = await api.put<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/refer`, {
    departmentId,
    remarks,
  });
  return data.data;
}

async function checkIn(id: number) {
  const { data } = await api.post<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/check-in`);
  return data.data;
}

async function checkOut(id: number) {
  const { data } = await api.post<ApiSuccess<VisitorRequest>>(`/visitor-requests/${id}/check-out`);
  return data.data;
}

export const requestService = {
  list,
  getById,
  dashboard,
  approve,
  reject,
  assign,
  queue,
  scheduleAppointment,
  resolve,
  cancel,
  setPriority,
  referToDepartment,
  checkIn,
  checkOut,
};
