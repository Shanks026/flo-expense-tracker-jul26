/** Ticked by the hooks from what happens in the session. */
export type SessionCheckId = 'edited' | 'review' | 'commit' | 'pushed'

/** Read from the ticket file's `## Tracer` checklist. */
export type TracerCheckId = 'code' | 'verified' | 'green'

export type TicketStatus = 'active' | 'queued' | 'done'

export type Ticket = {
  /** `<feature-slug>/<NN>`, e.g. `nudge-and-weekly-recap/01`. */
  id: string
  feature: string
  /** The ticket's number within its feature (the file's `NN-` prefix). */
  number: number
  title: string
  /** The ticket file, relative to the repo root. */
  path: string
  /** The file's `Status:` line (ready-for-agent, open, resolved, ...). */
  fileStatus: string
  /** Ticket numbers in the same feature, from the `Blocked by:` line. */
  blockedBy: number[]
  /** Any part of the `Blocked by:` line that is not a ticket number here. */
  blockedNote?: string
  tracer: Record<TracerCheckId, boolean>
  checks: Record<SessionCheckId, boolean>
  status: TicketStatus
  branch?: string
  /** Epoch ms when the ticket was added and when it last changed. */
  addedAt: number
  updatedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'flo-ticket-tracker': { tickets: Shaped<Ticket[]> }
  }
}
