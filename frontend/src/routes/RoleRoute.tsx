import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_HOME } from '../utils/constants';
import type { RoleCode } from '../types';

export function RoleRoute({ allow }: { allow: RoleCode[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.roleCode)) {
    return <Navigate to={ROLE_HOME[user.roleCode]} replace />;
  }
  return <Outlet />;
}
