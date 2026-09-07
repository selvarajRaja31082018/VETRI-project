import { api } from './api';
import type { ApiSuccess, PaginatedResult, RoleCode, UserAccount } from '../types';

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: RoleCode;
  status?: 'active' | 'inactive';
}

export interface CreateUserPayload {
  name: string;
  email?: string;
  mobile?: string;
  roleCode: RoleCode;
  designation?: string;
  password?: string;
}

async function list(query: UserListQuery): Promise<PaginatedResult<UserAccount>> {
  const { data } = await api.get<ApiSuccess<PaginatedResult<UserAccount>>>('/users', { params: query });
  return data.data;
}

async function getById(id: number): Promise<UserAccount> {
  const { data } = await api.get<ApiSuccess<UserAccount>>(`/users/${id}`);
  return data.data;
}

async function create(payload: CreateUserPayload): Promise<UserAccount> {
  const { data } = await api.post<ApiSuccess<UserAccount>>('/users', payload);
  return data.data;
}

async function update(id: number, payload: Partial<CreateUserPayload>): Promise<UserAccount> {
  const { data } = await api.put<ApiSuccess<UserAccount>>(`/users/${id}`, payload);
  return data.data;
}

async function setStatus(id: number, isActive: boolean): Promise<UserAccount> {
  const { data } = await api.put<ApiSuccess<UserAccount>>(`/users/${id}/status`, { isActive });
  return data.data;
}

async function resetPassword(id: number): Promise<{ temporaryPassword: string }> {
  const { data } = await api.post<ApiSuccess<{ temporaryPassword: string }>>(`/users/${id}/reset-password`);
  return data.data;
}

export const userService = { list, getById, create, update, setStatus, resetPassword };
