import type { RoleCode } from '../../types';

/**
 * Demo sign-in shortcuts for the login screen, matching the prototype's
 * role-selection cards (Screen 1.1) but wired to the real auth flow.
 *
 * SECURITY NOTE: this repository is public, so these credentials are
 * publicly visible in the deployed bundle and git history. Only keep real
 * account passwords here if those accounts guard nothing sensitive - rotate
 * them (Admin -> Users -> Reset password) if that ever stops being true.
 */
export interface DemoAccount {
  roleCode: RoleCode;
  label: string;
  caption: string;
  identifier: string;
  password: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    roleCode: 'G',
    label: 'Gate Operator',
    caption: 'Register & check-in',
    identifier: 'gate@vetri.local',
    password: 'GatePass@123',
  },
  {
    roleCode: 'P',
    label: 'Office Staff / PA',
    caption: 'Approve & manage requests',
    identifier: 'pa@vetri.local',
    password: 'PaPass@1234',
  },
  {
    roleCode: 'R',
    label: 'Elected Representative',
    caption: 'Meet visitors & resolve issues',
    identifier: 'rep@vetri.local',
    password: 'RepPass@123',
  },
  {
    roleCode: 'A',
    label: 'Administrator',
    caption: 'Analytics & configuration',
    identifier: 'admin@vetri.local',
    password: 'VetriAdmin@2026',
  },
];
