import { useAsync } from './useAsync';
import { masterDataService } from '../services/masterDataService';
import type { VisitorType } from '../types';

export function useDepartments() {
  return useAsync(() => masterDataService.listDepartments(), []);
}

export function useRepresentatives() {
  return useAsync(() => masterDataService.listRepresentatives(), []);
}

export function useVisitReasons(visitorType?: VisitorType) {
  return useAsync(() => masterDataService.listReasons(visitorType), [visitorType]);
}
