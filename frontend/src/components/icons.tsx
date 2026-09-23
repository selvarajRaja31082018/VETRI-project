import type { SVGProps } from 'react';

/**
 * Line icon set.
 *
 * Hand-rolled rather than pulled from an icon package: the app needs roughly
 * twenty glyphs, and a library would add a dependency (and, for most of them, a
 * bundle) far larger than the markup below. Every icon shares one 24x24 grid,
 * 1.75 stroke width and `currentColor`, so they sit consistently next to text
 * and inherit hover/active colours for free.
 */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------- navigation */

export const IconGrid = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

export const IconUserPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="8.5" cy="7" r="3.5" />
    <path d="M18 8v6M21 11h-6" />
  </Icon>
);

export const IconUserCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="8.5" cy="7" r="3.5" />
    <path d="m16.5 11.5 2 2 4-4" />
  </Icon>
);

export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7" r="3.5" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16 3.63a4 4 0 0 1 0 7.75" />
  </Icon>
);

export const IconShieldAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5.5c0 4.3 2.9 8.3 7 9.5 4.1-1.2 7-5.2 7-9.5V6l-7-3Z" />
    <path d="M12 9v4M12 16.5v.01" />
  </Icon>
);

export const IconClipboard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v1h-6v-1Z" />
    <path d="M9 11h6M9 15h4" />
  </Icon>
);

export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const IconHistory = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v4h4" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const IconChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
);

export const IconFile = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.4 18.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 14H4a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5.6 7.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.4 1H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.4 1Z" />
  </Icon>
);

export const IconShieldUser = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5.5c0 4.3 2.9 8.3 7 9.5 4.1-1.2 7-5.2 7-9.5V6l-7-3Z" />
    <circle cx="12" cy="10.5" r="2" />
    <path d="M8.6 16.5a3.6 3.6 0 0 1 6.8 0" />
  </Icon>
);

/* ------------------------------------------------------------------- chrome */

export const IconMenu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

export const IconLogOut = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <path d="m16 16 4-4-4-4M20 12H9" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17v.01" />
  </Icon>
);

/* ------------------------------------------------------------------- camera */

export const IconCamera = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.5A2 2 0 0 1 5 6.5h2.2l1.2-2h7.2l1.2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);

export const IconPhone = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </Icon>
);

export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 11a8 8 0 0 0-14-4.2L3 10M4 13a8 8 0 0 0 14 4.2l3-3.2" />
    <path d="M3 5v5h5M21 19v-5h-5" />
  </Icon>
);

/* -------------------------------------------------------------- form fields */

export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.75" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const IconMobile = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 5.2a2 2 0 0 1 2-2h1.8a1 1 0 0 1 1 .8l.6 2.6a1 1 0 0 1-.5 1.1l-1.4.8a12 12 0 0 0 5.5 5.5l.8-1.4a1 1 0 0 1 1.1-.5l2.6.6a1 1 0 0 1 .8 1v1.8a2 2 0 0 1-2 2A14.8 14.8 0 0 1 5.5 5.2Z" />
  </Icon>
);

export const IconMapPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-5.2 7-10.5a7 7 0 1 0-14 0C5 15.8 12 21 12 21Z" />
    <circle cx="12" cy="10.5" r="2.5" />
  </Icon>
);

export const IconBuilding = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 21V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15" />
    <path d="M15 10h3a2 2 0 0 1 2 2v9M2 21h20M8 8h3M8 12h3M8 16h3" />
  </Icon>
);

export const IconTag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12.6V5a2 2 0 0 1 2-2h7.6a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 0 2.8l-7.6 7.6a2 2 0 0 1-2.8 0L3.6 14A2 2 0 0 1 3 12.6Z" />
    <circle cx="8" cy="8" r="1.4" />
  </Icon>
);

export const IconFlag = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21V4M5 4h11l-1.6 3.5L16 11H5" />
  </Icon>
);
