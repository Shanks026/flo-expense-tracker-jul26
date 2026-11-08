import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SessionCheckId, Ticket, TracerCheckId } from '../types'

// FLO ticket tracker: a copy of the global ticket-tracker mod, reworked for
// FLO's local markdown tracker (docs/agents/issue-tracker.md). A card per
// ticket file in .scratch/<feature>/issues/NN-<slug>.md. The file is the
// source of truth for the title, Status, Blocked by and the Tracer checklist;
// the hooks add live ticks from what happens in the session (edits, reviews,
// commits, pushes). Nothing here writes to a ticket file: Green signal and
// `Status: resolved` stay the person's.

const PLUGIN = 'flo-ticket-tracker'
const PANE = 'flo-ticket-tracker'
const STORE_KEY = 'flo-tickets-v1'
const REFRESH_MS = 30_000
const TOOL_NAME = 'tickets'
const SCRATCH = '.scratch'

const tickets = atom({ plugin: 'flo-ticket-tracker', key: 'tickets' } as const, [], {
  shape: 'flo-tickets-1',
})

const SESSION_CHECKS: { id: SessionCheckId; label: string }[] = [
  { id: 'edited', label: 'Edited' },
  { id: 'review', label: 'Review' },
  { id: 'commit', label: 'Commit' },
  { id: 'pushed', label: 'Pushed' },
]

const TRACER_CHECKS: { id: TracerCheckId; label: string; line: RegExp }[] = [
  { id: 'code', label: 'Code', line: /^\s*-\s*\[([ xX])\]\s*Code implementation/m },
  { id: 'verified', label: 'Verified', line: /^\s*-\s*\[([ xX])\]\s*Verified/m },
  { id: 'green', label: 'Green signal', line: /^\s*-\s*\[([ xX])\]\s*Green signal/m },
]

const IMPLEMENT_SKILL = /(^|:)(implement|implement-spec|tdd)$/
const REVIEW_SKILL = /(^|:)code-review$/
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])

const COMMIT_CMD = /\bgit\b[^;&|\n]*\bcommit\b/
const PUSH_CMD = /\bgit\b[^;&|\n]*\bpush\b/

// `.scratch/<feature>/issues/NN-slug.md`, with either slash.
const TICKET_PATH = /\.scratch[\\/]([\w.-]+)[\\/]issues[\\/](\d+)-[\w.-]*\.md/g
// `<feature>/NN` or a bare feature slug, for /flo-tickets add.
const FEATURE_REF = /^([\w.-]+?)(?:\/(\d+))?$/

const noSessionChecks = (): Record<SessionCheckId, boolean> => ({
  edited: false,
  review: false,
  commit: false,
  pushed: false,
})

const pad = (n: number) => String(n).padStart(2, '0')
const idOf = (feature: string, number: number) => `${feature}/${pad(number)}`

// ---------- reading ticket files ----------

type Parsed = Pick<Ticket, 'title' | 'fileStatus' | 'blockedBy' | 'blockedNote' | 'tracer'> & { isWayfinder: boolean }

// A `Key:` line, bare or bolded (`**Status:** x`).
function field(text: string, key: string): string | undefined {
  // [ \t], not \s: an empty `Blocked by:` must not run on into the next line.
  const m = new RegExp(`^[ \\t]*\\*{0,2}${key}:\\*{0,2}[ \\t]*(.*?)[ \\t]*$`, 'mi').exec(text)
  return m?.[1] !== undefined ? m[1].replace(/^\*+|\*+$/g, '').trim() : undefined
}

function parseTicket(text: string, fallbackTitle: string): Parsed {
  const title = /^#\s+(.+?)\s*$/m.exec(text)?.[1] ?? fallbackTitle
  const fileStatus = (field(text, 'Status') ?? 'open').toLowerCase()
  const blockedLine = field(text, 'Blocked by') ?? ''
  const blockedBy: number[] = []
  const other: string[] = []
  for (const part of blockedLine.split(',').map(s => s.trim()).filter(Boolean)) {
    const n = /^(\d{1,3})\b/.exec(part)
    if (n) blockedBy.push(Number(n[1]))
    else if (!/^(none\b|—|-$|n\/a)/i.test(part)) other.push(part)
  }
  if (/^none\b/i.test(blockedLine)) other.length = 0
  const tracer = { code: false, verified: false, green: false }
  for (const c of TRACER_CHECKS) tracer[c.id] = /x/i.test(c.line.exec(text)?.[1] ?? '')
  return {
    title,
    fileStatus,
    blockedBy,
    blockedNote: other.length > 0 ? other.join(', ') : undefined,
    tracer,
    isWayfinder: field(text, 'Type') !== undefined,
  }
}

const isResolved = (t: Pick<Ticket, 'fileStatus' | 'tracer'>) => t.fileStatus === 'resolved' || t.tracer.green

async function issueFiles($: EngineInterface, feature: string): Promise<{ number: number; path: string; name: string }[]> {
  const dir = `${SCRATCH}/${feature}/issues`
  if (!(await $.fs.exists(dir))) return []
  const entries = await $.fs.list(dir)
  return entries
    .filter(f => f.kind === 'file' && /^\d+-.*\.md$/.test(f.name))
    .map(f => ({ number: Number(/^(\d+)/.exec(f.name)![1]), path: `${dir}/${f.name}`, name: f.name }))
    .sort((a, b) => a.number - b.number)
}

async function features($: EngineInterface): Promise<string[]> {
  if (!(await $.fs.exists(SCRATCH))) return []
  const out: string[] = []
  for (const d of await $.fs.list(SCRATCH)) {
    if (d.kind === 'dir' && (await $.fs.exists(`${SCRATCH}/${d.name}/issues`))) out.push(d.name)
  }
  return out.sort()
}

async function loadTicket($: EngineInterface, feature: string, file: { number: number; path: string; name: string }) {
  const text = await $.fs.read(file.path)
  const parsed = parseTicket(String(text), file.name.replace(/\.md$/, ''))
  return { feature, number: file.number, path: file.path, ...parsed }
}

// ---------- state ----------

async function save($: EngineInterface, fn: (list: Ticket[]) => Ticket[]) {
  const next = await update($, tickets, list => promote(fn(list ?? [])))
  await $.store.set(STORE_KEY, next)
  return next
}

// Keep exactly one active ticket while anything is queued and unblocked.
function promote(list: Ticket[]): Ticket[] {
  if (list.some(t => t.status === 'active')) return list
  const first = list.find(t => t.status === 'queued' && openBlockers(t, list).length === 0)
  return first ? list.map(t => (t.id === first.id ? { ...t, status: 'active', updatedAt: Date.now() } : t)) : list
}

function openBlockers(t: Ticket, list: Ticket[]): number[] {
  return t.blockedBy.filter(n => {
    const b = list.find(x => x.id === idOf(t.feature, n))
    return !b || !isResolved(b)
  })
}

async function activeTicket($: EngineInterface): Promise<Ticket | undefined> {
  const list: Ticket[] = (await read($, tickets)) ?? []
  return list.find(t => t.status === 'active')
}

async function tick($: EngineInterface, id: string, patch: Partial<Record<SessionCheckId, boolean>>, extra: Partial<Ticket> = {}) {
  await save($, list =>
    list.map(t => (t.id === id ? { ...t, ...extra, checks: { ...t.checks, ...patch }, updatedAt: Date.now() } : t)),
  )
}

async function setStatus($: EngineInterface, id: string, status: Ticket['status']) {
  await save($, list =>
    list.map(t => {
      if (status === 'active' && t.status === 'active' && t.id !== id) return { ...t, status: 'queued' }
      return t.id === id ? { ...t, status, updatedAt: Date.now() } : t
    }),
  )
}

function describe(list: Ticket[]): string {
  if (list.length === 0) return 'No tickets tracked.'
  return list
    .map(t => {
      const tracer = TRACER_CHECKS.filter(c => t.tracer[c.id]).map(c => c.label).join(', ') || 'none'
      const live = SESSION_CHECKS.filter(c => t.checks[c.id]).map(c => c.label).join(', ') || 'none'
      const blocked = openBlockers(t, list)
      const b = blocked.length > 0 ? ` | blocked by ${blocked.map(pad).join(', ')}` : ''
      return `${t.id} [${t.status}] ${t.title} | Status: ${t.fileStatus}${b} | tracer: ${tracer} | session: ${live} | ${t.path}`
    })
    .join('\n')
}

// ---------- adding tickets ----------

type Ref = { feature: string; number?: number }

// Ticket paths, `<feature>/NN`, or a bare feature slug.
function parseRefs(text: string): Ref[] {
  const out: Ref[] = []
  const seen = new Set<string>()
  const push = (r: Ref) => {
    const key = `${r.feature}/${r.number ?? '*'}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(r)
    }
  }
  for (const m of text.matchAll(TICKET_PATH)) if (m[1]) push({ feature: m[1], number: Number(m[2]) })
  const rest = text.replace(TICKET_PATH, ' ')
  for (const word of rest.split(/[\s,]+/).filter(Boolean)) {
    const m = FEATURE_REF.exec(word.replace(/^\.scratch[\\/]/, '').replace(/[\\/]$/, ''))
    if (m?.[1] && /[a-z]/i.test(m[1])) push({ feature: m[1], number: m[2] ? Number(m[2]) : undefined })
  }
  return out
}

// Adds every ticket of each named feature (so blockers show), and makes the
// first named ticket (or the feature's first open, unblocked one) active.
async function addRefs($: EngineInterface, refs: Ref[]): Promise<{ added: Ticket[]; focus?: string; missing: string[] }> {
  const fresh: Ticket[] = []
  const missing: string[] = []
  let focus: string | undefined
  for (const ref of refs) {
    const files = await issueFiles($, ref.feature)
    if (files.length === 0) {
      missing.push(ref.feature)
      continue
    }
    if (ref.number !== undefined && !files.some(f => f.number === ref.number)) {
      missing.push(idOf(ref.feature, ref.number))
      continue
    }
    for (const f of files) {
      if (fresh.some(t => t.id === idOf(ref.feature, f.number))) continue
      try {
        const p = await loadTicket($, ref.feature, f)
        if (p.isWayfinder) continue
        const now = Date.now()
        const { isWayfinder: _w, ...rest } = p
        fresh.push({
          id: idOf(ref.feature, f.number),
          ...rest,
          checks: noSessionChecks(),
          status: isResolved(p) ? 'done' : 'queued',
          addedAt: now,
          updatedAt: now,
        })
      } catch (err) {
        $.ui.toast(`${PLUGIN}: could not read ${f.path}: ${String((err as Error).message ?? err).slice(0, 120)}`)
      }
    }
    if (!focus && ref.number !== undefined) focus = idOf(ref.feature, ref.number)
  }
  if (fresh.length === 0) return { added: [], missing }

  await save($, list => {
    const old = new Map(list.map(t => [t.id, t]))
    const ids = new Set(fresh.map(t => t.id))
    // Re-adding a known ticket keeps its session ticks and status.
    const merged = fresh.map(t => {
      const was = old.get(t.id)
      if (!was) return t
      return { ...t, checks: was.checks, branch: was.branch, addedAt: was.addedAt, status: isResolved(t) ? 'done' : was.status }
    })
    const all = [...merged, ...list.filter(t => !ids.has(t.id))]
    const target =
      focus ?? merged.find(t => t.status !== 'done' && openBlockers(t, all).length === 0)?.id
    if (!target || all.find(t => t.id === target)?.status === 'done') return all
    return all.map(t => {
      if (t.id === target) return { ...t, status: 'active' as const }
      return t.status === 'active' ? { ...t, status: 'queued' as const } : t
    })
  })
  return { added: fresh, focus, missing }
}

// ---------- reconciling with the files ----------

async function refresh($: EngineInterface) {
  const list: Ticket[] = (await read($, tickets)) ?? []
  if (list.length === 0) return
  const updates = new Map<string, Partial<Ticket>>()
  const gone = new Set<string>()
  for (const feature of new Set(list.map(t => t.feature))) {
    let files: Awaited<ReturnType<typeof issueFiles>> = []
    try {
      files = await issueFiles($, feature)
    } catch {
      continue
    }
    for (const t of list.filter(x => x.feature === feature)) {
      const f = files.find(x => x.number === t.number)
      if (!f) {
        gone.add(t.id)
        continue
      }
      try {
        const { isWayfinder: _w, ...p } = await loadTicket($, feature, f)
        updates.set(t.id, p)
      } catch {
        // Unreadable for a moment (mid-write): try again on the next tick.
      }
    }
  }
  await save($, cur =>
    cur
      .filter(t => !gone.has(t.id))
      .map(t => {
        const p = updates.get(t.id)
        if (!p) return t
        const changed = JSON.stringify([p.title, p.fileStatus, p.blockedBy, p.blockedNote, p.tracer, p.path]) !==
          JSON.stringify([t.title, t.fileStatus, t.blockedBy, t.blockedNote, t.tracer, t.path])
        if (!changed) return t
        const next = { ...t, ...p }
        const status = isResolved(next) ? 'done' : t.status === 'done' ? 'queued' : t.status
        return { ...next, status, updatedAt: Date.now() }
      }),
  )
}

function normaliseId(raw: string): string {
  const r = parseRefs(raw)[0]
  return r && r.number !== undefined ? idOf(r.feature, r.number) : raw
}

async function runAdd($: EngineInterface, text: string): Promise<string> {
  const refs = parseRefs(text)
  if (refs.length === 0) return 'Name a feature, a feature/NN id or a ticket path, e.g. "nudge-and-weekly-recap".'
  const { added, focus, missing } = await addRefs($, refs)
  const parts: string[] = []
  if (added.length > 0) parts.push(`Tracking ${added.length} ticket(s)${focus ? `; ${focus} is active` : ''}.`)
  if (missing.length > 0) parts.push(`Not found: ${missing.join(', ')}.`)
  return parts.join(' ') || 'Nothing new.'
}

const touchesScratch =(e: any) => /\.scratch[\\/]/.test(String(e.file_path ?? e.notebook_path ?? ''))

export const register: Register = on => {
  // ---------- lifecycle ----------

  on('session.start', async ($, e, next) => {
    const stored = (await $.store.get(STORE_KEY)) as Ticket[] | undefined
    const current: Ticket[] = (await read($, tickets)) ?? []
    if (current.length === 0 && Array.isArray(stored)) await update($, tickets, () => stored)

    await $.command.register({
      name: 'flo-tickets',
      description:
        'Show FLO\'s ticket tracker. `/flo-tickets add nudge-and-weekly-recap` tracks a feature\'s tickets; ' +
        '`/flo-tickets features` lists them; `/flo-tickets clear` drops finished ones.',
      argumentHint: '[add <feature | feature/NN | path> | features | refresh | clear]',
    })
    $.clock.every(REFRESH_MS, () => {
      void refresh($)
    })
    void refresh($)
    await $.tool.register({
      name: TOOL_NAME,
      description:
        'Drive FLO\'s ticket tracker pane (local markdown tickets in .scratch/<feature>/issues/NN-*.md). ' +
        'action "open" shows it; "add" tracks the tickets named in refs (a feature slug such as ' +
        '"nudge-and-weekly-recap" adds all its tickets, "nudge-and-weekly-recap/01" or a ticket path ' +
        'adds the feature and makes that ticket active); "start" makes the ticket in id active (hooks ' +
        'tick Edited, Review, Commit and Pushed for it); "done" marks it done on the board only (it never ' +
        'edits the file); "refresh" re-reads every tracked file; "features" lists the .scratch features ' +
        'with tickets; "status" lists every card. Status, Blocked by and the Tracer checklist always ' +
        'come from the ticket file.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['open', 'add', 'start', 'done', 'refresh', 'features', 'status'] },
          refs: { type: 'string', description: 'For "add": feature slugs, feature/NN ids or ticket paths.' },
          id: { type: 'string', description: 'For "start" and "done": the ticket id, e.g. "nudge-and-weekly-recap/01".' },
        },
        required: ['action'],
      },
    })
    return next(e)
  })

  on('tool.call', { tool: `mcp__${PLUGIN}__${TOOL_NAME}` }, async ($, e) => {
    const input = e as any
    const action = String(input.action ?? 'status')
    let note = ''
    if (action === 'add') {
      note = await runAdd($, String(input.refs ?? ''))
    } else if (action === 'start' || action === 'done') {
      const id = normaliseId(String(input.id ?? ''))
      const list: Ticket[] = (await read($, tickets)) ?? []
      if (!list.some(t => t.id === id)) return { result: `${id || '(no id)'} is not tracked; "add" it first.` }
      await setStatus($, id, action === 'start' ? 'active' : 'done')
      note = `${id} is now ${action === 'start' ? 'active' : 'done'} on the board.`
    } else if (action === 'refresh') {
      await refresh($)
      note = 'Re-read the ticket files.'
    } else if (action === 'features') {
      return { result: (await features($)).join('\n') || 'No .scratch features with an issues folder.' }
    }
    if (action !== 'status') await $.ui.open({ id: PANE, title: 'FLO tickets' })
    const list: Ticket[] = (await read($, tickets)) ?? []
    return { result: [note, describe(list)].filter(Boolean).join('\n') }
  })

  on('command.run', { command: 'flo-tickets' }, async ($, e) => {
    const args = String((e as any).args ?? '').trim()
    if (args.startsWith('add')) {
      const text = await runAdd($, args.slice(3))
      await $.ui.open({ id: PANE, title: 'FLO tickets' })
      return { text }
    }
    if (args === 'features') {
      return { text: (await features($)).join('\n') || 'No .scratch features with an issues folder.' }
    }
    if (args === 'refresh') {
      await refresh($)
      return { text: 'Re-read the ticket files.' }
    }
    if (args === 'clear') {
      await save($, list => list.filter(t => t.status !== 'done'))
      return { text: 'Cleared finished tickets.' }
    }
    await $.ui.open({ id: PANE, title: 'FLO tickets' })
    return { text: 'FLO ticket tracker opened.' }
  })

  // ---------- what starts and ticks a ticket ----------

  on('skill.prompt', async ($, e, next) => {
    const out = await next(e)
    if (IMPLEMENT_SKILL.test(e.skill)) {
      const argsText = /ARGUMENTS:\s*([\s\S]*)$/.exec(e.text)?.[1] ?? ''
      const refs: Ref[] = [...argsText.matchAll(TICKET_PATH)].flatMap(m => (m[1] ? [{ feature: m[1], number: Number(m[2]) }] : []))
      if (refs.length > 0) {
        void addRefs($, refs).then(r => {
          if (r.added.length > 0) void $.ui.open({ id: PANE, title: 'FLO tickets' })
        })
      }
    } else if (REVIEW_SKILL.test(e.skill)) {
      const active = await activeTicket($)
      if (active) await tick($, active.id, { review: true })
    }
    return out
  })

  on('tool.call', async ($, e, next) => {
    const ran: any = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const tool = String(e.tool)
    if (!EDIT_TOOLS.has(tool) && tool !== 'Bash' && tool !== 'PowerShell') return ran

    if (EDIT_TOOLS.has(tool)) {
      // An edit to a ticket file (Tracer ticks, Status, comments) re-reads the
      // board; any other edit counts as work on the active ticket.
      if (touchesScratch(e)) {
        await refresh($)
        return ran
      }
      const active = await activeTicket($)
      if (active && !active.checks.edited) await tick($, active.id, { edited: true })
      return ran
    }

    const active = await activeTicket($)
    if (!active) return ran
    const command = String((e as any).command ?? '')
    const patch: Partial<Record<SessionCheckId, boolean>> = {}
    const extra: Partial<Ticket> = {}
    if (COMMIT_CMD.test(command)) {
      patch.commit = true
      try {
        const head = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 5_000 })
        if (head.exitCode === 0) extra.branch = head.stdout.trim()
      } catch {
        // Not a git checkout: leave the branch unknown.
      }
    }
    if (PUSH_CMD.test(command)) patch.pushed = true
    if (Object.keys(patch).length > 0) await tick($, active.id, patch, extra)
    return ran
  })

  // ---------- the pane ----------

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list: Ticket[] = (await read($, tickets)) ?? []

    if (list.length === 0) {
      return (
        <Box flexDirection="column" alignItems="center" justifyContent="center" paddingY="xl" rowGap="sm">
          <Text size="heading" weight="semibold">No tickets yet</Text>
          <Text size="footnote" color="subtle">
            Cards appear when /implement picks up a .scratch ticket, or with /flo-tickets add nudge-and-weekly-recap.
          </Text>
        </Box>
      )
    }

    const order = { active: 0, queued: 1, done: 2 } as const
    const sorted = [...list].sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        a.feature.localeCompare(b.feature) ||
        a.number - b.number,
    )
    const active = list.filter(t => t.status === 'active').length
    const queued = list.filter(t => t.status === 'queued').length
    const done = list.filter(t => t.status === 'done').length
    const summary = [active > 0 ? `${active} in progress` : '', queued > 0 ? `${queued} up next` : '', done > 0 ? `${done} done` : '']
      .filter(Boolean)
      .join('  ·  ')

    const STATUS = {
      active: { label: 'In progress', color: 'claude' },
      queued: { label: 'Up next', color: 'suggestion' },
      blocked: { label: 'Blocked', color: 'warning' },
      done: { label: 'Done', color: 'success' },
    } as const

    const badge = (key: string, label: string, color: string) => (
      <Box key={key} backgroundColor={color} paddingX="sm">
        <Text size="caption" weight="semibold" color="inverseText">{label}</Text>
      </Box>
    )

    const card = (t: Ticket) => {
      const blockers = t.status === 'done' ? [] : openBlockers(t, list)
      const s = STATUS[t.status === 'queued' && blockers.length > 0 ? 'blocked' : t.status]
      const meta = [
        t.feature,
        `Status: ${t.fileStatus}`,
        blockers.length > 0 ? `blocked by ${blockers.map(pad).join(', ')}` : '',
        t.blockedNote ? `waits on ${t.blockedNote}` : '',
        t.branch ? `branch ${t.branch}` : '',
      ]
        .filter(Boolean)
        .join('  ·  ')
      const isDone = t.status === 'done'
      return (
        <Box key={`card-${t.id}`} flexDirection="column" borderStyle="round" borderDimColor paddingX="md" paddingY="sm" rowGap="xs">
          <Box flexDirection="row" justifyContent="space-between" alignItems="center" columnGap="md">
            <Box flexShrink={1}>
              <Text size="body" weight="semibold" wrap="truncate-end">
                {t.title}
              </Text>
            </Box>
            {badge(`status-${t.id}`, s.label, s.color)}
          </Box>
          {!isDone && (
            <Box flexDirection="row" flexWrap="wrap" columnGap="md">
              {TRACER_CHECKS.map(c => (
                <Text key={`tr-${t.id}-${c.id}`} size="footnote" color={t.tracer[c.id] ? 'success' : 'inactive'}>
                  {t.tracer[c.id] ? '✓' : '○'} {c.label}
                </Text>
              ))}
              <Text key={`sep-${t.id}`} size="footnote" color="inactive">│</Text>
              {SESSION_CHECKS.map(c => (
                <Text key={`ss-${t.id}-${c.id}`} size="footnote" color={t.checks[c.id] ? 'success' : 'inactive'}>
                  {t.checks[c.id] ? '✓' : '○'} {c.label}
                </Text>
              ))}
            </Box>
          )}
          <Box flexDirection="row" justifyContent="space-between" alignItems="center" columnGap="md">
            <Box flexShrink={1}>
              <Text size="caption" color="inactive" wrap="truncate-end">{meta}</Text>
            </Box>
            <Box flexDirection="row" columnGap="sm">
              {t.status === 'queued' && <Button key={`start-${t.id}`} label="Start" onPress={() => void setStatus($, t.id, 'active')} />}
              {t.status === 'active' && <Button key={`done-${t.id}`} label="Mark done" onPress={() => void setStatus($, t.id, 'done')} />}
              <Button key={`rm-${t.id}`} label="Remove" onPress={() => void save($, l => l.filter(x => x.id !== t.id))} />
            </Box>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" rowGap="md" paddingX="sm" paddingY="sm">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flexDirection="column">
            <Text size="title" weight="semibold">FLO tickets</Text>
            <Text size="footnote" color="subtle">{summary}</Text>
          </Box>
          <Box flexDirection="row" columnGap="sm">
            <Button key="refresh" label="Refresh" onPress={() => void refresh($)} />
            {done > 0 ? <Button key="clear" label="Clear done" onPress={() => void save($, l => l.filter(t => t.status !== 'done'))} /> : null}
          </Box>
        </Box>
        <Box flexDirection="column" rowGap="sm">{sorted.map(card)}</Box>
      </Box>
    )
  })
}
