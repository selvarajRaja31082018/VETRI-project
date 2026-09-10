import { api } from './api';
import type { ApiSuccess, Department, Representative, VisitorType, VisitReason } from '../types';

async function listRepresentatives(): Promise<Representative[]> {
  const { data } = await api.get<ApiSuccess<Representative[]>>('/master-data/representatives');
  return data.data;
}

async function listDepartments(options: { includeInactive?: boolean } = {}): Promise<Department[]> {
  const { data } = await api.get<ApiSuccess<Department[]>>('/master-data/departments', {
    params: options.includeInactive ? { includeInactive: true } : {},
  });
  return data.data;
}

async function addDepartment(name: string): Promise<Department> {
  const { data } = await api.post<ApiSuccess<Department>>('/master-data/departments', { name });
  return data.data;
}

async function setDepartmentActive(id: number, isActive: boolean): Promise<void> {
  await api.put(`/master-data/departments/${id}/status`, { isActive });
}

async function listReasons(
  visitorType?: VisitorType,
  options: { includeInactive?: boolean } = {},
): Promise<VisitReason[]> {
  const { data } = await api.get<ApiSuccess<VisitReason[]>>('/master-data/visit-reasons', {
    params: {
      ...(visitorType ? { visitorType } : {}),
      ...(options.includeInactive ? { includeInactive: true } : {}),
    },
  });
  return data.data;
}

async function resetToDefaults(): Promise<{ departments: Department[]; reasons: VisitReason[] }> {
  const { data } = await api.post<ApiSuccess<{ departments: Department[]; reasons: VisitReason[] }>>(
    '/master-data/reset-defaults',
  );
  return data.data;
}

async function addReason(visitorType: VisitorType, reason: string): Promise<VisitReason> {
  const { data } = await api.post<ApiSuccess<VisitReason>>('/master-data/visit-reasons', {
    visitorType,
    reason,
  });
  return data.data;
}

async function setReasonActive(id: number, isActive: boolean): Promise<void> {
  await api.put(`/master-data/visit-reasons/${id}/status`, { isActive });
}

export const masterDataService = {
  listRepresentatives,
  listDepartments,
  addDepartment,
  setDepartmentActive,
  listReasons,
  addReason,
  setReasonActive,
  resetToDefaults,
};
