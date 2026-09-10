import { useAsync } from './useAsync';
import { masterDataService } from '../services/masterDataService';
import type { VisitorType } from '../types';

export function useDepartments(options: { includeInactive?: boolean } = {}) {
  return useAsync(() => masterDataService.listDepartments(options), [options.includeInactive]);
}

export function useRepresentatives() {
  return useAsync(() => masterDataService.listRepresentatives(), []);
}

export function useVisitReasons(visitorType?: VisitorType, options: { includeInactive?: boolean } = {}) {
  return useAsync(
    () => masterDataService.listReasons(visitorType, options),
    [visitorType, options.includeInactive],
  );
}
