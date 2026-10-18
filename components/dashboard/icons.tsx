import React from "react";

export function LogoIcon({ className = "", size = 13 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M2 2l10 5-10 5V9l6-2-6-2V2z" fill="currentColor" />
    </svg>
  );
}

export function InboxIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M1 10h3l1.5 2h5L12 10h3V3a1 1 0 00-1-1H2a1 1 0 00-1 1v7z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M2.5 3.5a1 1 0 011-1h9a1 1 0 011 1v6.5a1 1 0 01-1 1H6L3 13.5v-2.5h-.5a1 1 0 01-1-1v-6.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StarIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4L8 10.4l-3.6 1.9.7-4L2.2 5.7l4-.6L8 1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DraftIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M2 2h8l4 4v8H2V2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M10 2v4h4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SendIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M2 2l12 6-12 6V9l8-1-8-1V2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CalendarIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect
        x="1.5"
        y="3"
        width="13"
        height="11.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M1.5 6.5h13M5 1.5v3M11 1.5v3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UpcomingIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 5v3.5l2 1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M10 10l4 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CommandIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M5 3a2 2 0 100 4h1V3H5zM6 7H3a2 2 0 000 4h3V7zM10 7v4h3a2 2 0 100-4h-3zM10 3v4h1a2 2 0 100-4h-1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HelpIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6.5 6a1.5 1.5 0 013 .5c0 1.5-1.5 1.5-1.5 3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.5" r=".55" fill="currentColor" />
    </svg>
  );
}

export function MicIcon({ className = "", size = 13 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect
        x="5.5"
        y="1.5"
        width="5"
        height="7"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M2.5 7.5A5.5 5.5 0 0013.5 7.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M8 13v2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ArrowUpIcon({ className = "", size = 13 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <path
        d="M7 11V3M3 7l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowRightIcon({ className = "", size = 12 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <path
        d="M2 7h10M8 3l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M8 1.5A4.5 4.5 0 003.5 6v4.5H2v1h12v-1h-1.5V6A4.5 4.5 0 008 1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 11.5a1.5 1.5 0 003 0"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function BackIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <path
        d="M9 3L5 7l4 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReplyIcon({ className = "", size = 13 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M6 4L2 8l4 4M2 8h8a4 4 0 014 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SidebarToggleIcon({ className = "", size = 15 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 2.5v11" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function LogoutIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M6 14H3.5a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 013.5 2H6M11 11.5L14.5 8 11 4.5M6 8h8.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PaperclipIcon({ className = "", size = 12 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" className={className}>
      <path
        d="M11 6L5.5 11.5A3.5 3.5 0 011 7l6-6a2 2 0 013 3L4 9.5A.5.5 0 013.5 9L8 4.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GmailIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M1.5 5l6.5 4.5L14.5 5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OutlookIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1" y="3" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M9 5.5h4.5a1 1 0 011 1v3a1 1 0 01-1 1H9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9 8h5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="5" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function ChevronRightIcon({ className = "", size = 11 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <path
        d="M4.5 2.5L7.5 6l-3 3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LabelIcon({ className = "", size = 13 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M2 4.5A1.5 1.5 0 013.5 3h6.086a1.5 1.5 0 011.06.44l2.915 2.914a1.5 1.5 0 010 2.122L10.646 11.39a1.5 1.5 0 01-1.06.44H3.5A1.5 1.5 0 012 10.33V4.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="5.5" cy="7.5" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export function TrashIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.7 8h4.6l.7-8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AllMailIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="4.5" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 6.5l6.5 4 6.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 3h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <path d="M5.5 1.5h5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

export function SpamIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M10.5 2h-5L2 5.5v5L5.5 14h5L14 10.5v-5L10.5 2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ConnectIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M6 3.5a2.5 2.5 0 015 0V6h1.5A1.5 1.5 0 0114 7.5v6a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13.5v-6A1.5 1.5 0 013.5 6H5V3.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 9.5v2M8 2v1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UsersIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M10.5 13.5v-1a2.5 2.5 0 00-2.5-2.5h-4a2.5 2.5 0 00-2.5 2.5v1M6.5 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM14.5 13.5v-1a2.49 2.49 0 00-1.8-2.4M10.5 2.1a2.5 2.5 0 010 4.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


