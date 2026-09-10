import { api } from './api';
import type { ApiSuccess } from '../types';

/** Upload a base64 `data:image/...;base64,...` capture and get back its stored URL. */
async function uploadPhoto(imageDataUrl: string): Promise<string> {
  const { data } = await api.post<ApiSuccess<{ url: string }>>('/uploads/photo', {
    image: imageDataUrl,
  });
  return data.data.url;
}

export const uploadService = { uploadPhoto };
