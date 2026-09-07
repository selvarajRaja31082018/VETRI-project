import { api } from './api';
import type { ApiSuccess, AuthUser } from '../types';

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

async function login(payload: LoginPayload): Promise<LoginResult> {
  const { data } = await api.post<ApiSuccess<LoginResult>>('/auth/login', payload);
  return data.data;
}

async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

async function me(): Promise<AuthUser> {
  const { data } = await api.get<ApiSuccess<AuthUser>>('/auth/me');
  return data.data;
}

export const authService = { login, logout, me };
