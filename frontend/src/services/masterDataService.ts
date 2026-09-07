import { api } from './api';
import type { ApiSuccess, Department, Representative, VisitorType, VisitReason } from '../types';

async function listRepresentatives(): Promise<Representative[]> {
  const { data } = await api.get<ApiSuccess<Representative[]>>('/master-data/representatives');
  return data.data;
}

async function listDepartments(): Promise<Department[]> {
  const { data } = await api.get<ApiSuccess<Department[]>>('/master-data/departments');
  return data.data;
}

async function addDepartment(name: string): Promise<Department> {
  const { data } = await api.post<ApiSuccess<Department>>('/master-data/departments', { name });
  return data.data;
}

async function setDepartmentActive(id: number, isActive: boolean): Promise<void> {
  await api.put(`/master-data/departments/${id}/status`, { isActive });
}

async function listReasons(visitorType?: VisitorType): Promise<VisitReason[]> {
  const { data } = await api.get<ApiSuccess<VisitReason[]>>('/master-data/visit-reasons', {
    params: visitorType ? { visitorType } : {},
  });
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
};
