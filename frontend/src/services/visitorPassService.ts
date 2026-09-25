import { api } from './api';
import type { ApiSuccess, VisitorPassResponse, VisitorVerification } from '../types';

/**
 * Visitor pass API.
 *
 * The pass belongs to a VISIT (a visitor_request), not to a person: a returning
 * visitor has one pass per visit, each with its own token, date and queue
 * status. That is why these are addressed by request id.
 */

/** Full pass for the screen, the print view and the PDF. */
async function getPass(requestId: number): Promise<VisitorPassResponse> {
  const { data } = await api.get<ApiSuccess<VisitorPassResponse>>(`/visitor-requests/${requestId}/pass`);
  return data.data;
}

/** Verification payload behind a scanned QR code. */
async function verify(requestId: number): Promise<VisitorVerification> {
  const { data } = await api.get<ApiSuccess<VisitorVerification>>(`/visitor-requests/${requestId}/verify`);
  return data.data;
}

async function emailPass(requestId: number, email: string): Promise<{ tokenNumber: string; sentTo: string }> {
  const { data } = await api.post<ApiSuccess<{ tokenNumber: string; sentTo: string }>>(
    `/visitor-requests/${requestId}/email-pass`,
    { email },
  );
  return data.data;
}

export const visitorPassService = { getPass, verify, emailPass };
