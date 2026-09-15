import { api } from './api';
import type { ApiSuccess } from '../types';

export interface SettingRow {
  setting_key: string;
  setting_value: string | null;
  updated_at: string;
}

async function list(): Promise<SettingRow[]> {
  const { data } = await api.get<ApiSuccess<SettingRow[]>>('/master-data/settings');
  return data.data;
}

async function update(key: string, value: string): Promise<void> {
  await api.put(`/master-data/settings/${encodeURIComponent(key)}`, { value });
}

export const settingsService = { list, update };
