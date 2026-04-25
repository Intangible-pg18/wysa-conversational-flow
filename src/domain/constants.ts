export const SessionStatus = {
    Active: "active",
    Completed: "completed",
    Expired: "expired"
} as const;

export const ResolverType = {
    Simple: "simple"
} as const

export const OptionKind = {
  Next: "next",
  Switch: "switch",
  Terminal: "terminal",
} as const;

export const COMPLETED_RECENT_DAYS = 7;
export const ABANDONED_EXPIRY_DAYS = 30;
export const daysToMs = (days: number): number => days * 24 * 60 * 60 * 1000;