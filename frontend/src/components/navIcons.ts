import {
  IconCalendar,
  IconChart,
  IconClipboard,
  IconFile,
  IconGrid,
  IconHistory,
  IconSettings,
  IconShieldAlert,
  IconShieldUser,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
} from './icons';

/**
 * Nav icon lookup, kept out of `icons.tsx` so that file exports components
 * only - a module mixing components with plain values breaks Fast Refresh.
 */
export const NAV_ICONS = {
  grid: IconGrid,
  userPlus: IconUserPlus,
  userCheck: IconUserCheck,
  users: IconUsers,
  shieldAlert: IconShieldAlert,
  clipboard: IconClipboard,
  calendar: IconCalendar,
  history: IconHistory,
  chart: IconChart,
  file: IconFile,
  settings: IconSettings,
  shieldUser: IconShieldUser,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
