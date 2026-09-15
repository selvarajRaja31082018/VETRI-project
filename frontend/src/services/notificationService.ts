import { api } from './api';
import type { ApiSuccess } from '../types';

export interface NotificationRow {
  id: number;
  title: string;
  message: string;
  is_read: 0 | 1;
  created_at: string;
  read_at: string | null;
}

async function list(): Promise<NotificationRow[]> {
  const { data } = await api.get<ApiSuccess<NotificationRow[]>>('/notifications');
  return data.data;
}

async function markRead(id: number): Promise<void> {
  await api.put(`/notifications/${id}/read`);
}

export const notificationService = { list, markRead };
