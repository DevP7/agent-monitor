import { atom, read, update } from 'claude-code'
import type { AgentInfo, Hook, Register, SessionRateLimit } from 'claude-code'

const PANE = 'agent-monitor'
const tick = atom({ plugin: 'agent-monitor', key: 'tick' } as const, 0)

type Dollar = Parameters<Hook<'session.measure'>>[0]

const WINDOW: Record<string, string> = {
  five_hour: 'Finestra 5 ore',
  seven_day: 'Finestra 7 giorni',
  spend_limit: 'Limite di spesa',
}
const SHORT: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7g',
  spend_limit: 'spesa',
}
const STATUS: Record<string, string> = {
  pending: 'in attesa',
  running: 'in corso',
  waiting: 'in pausa',
  idle: 'inattivo',
  completed: 'finito',
  failed: 'fallito',
  killed: 'fermato',
}

const isLive = (a: AgentInfo): boolean =>
  a.status === 'running' || a.status === 'waiting' || a.status === 'pending'

const levelOf = (percent: number): 'success' | 'warning' | 'error' =>
  percent >= 85 ? 'error' : percent >= 60 ? 'warning' : 'success'

const bar = (percent: number, width = 20): string => {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const resetsIn = (iso: string | undefined, now: number): string => {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  if (mins < 60) return `reset tra ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `reset tra ${hours} h ${mins % 60} min`
  return `reset tra ${Math.floor(hours / 24)} g ${hours % 24} h`
}

export const summarize = (
  agents: AgentInfo[],
  limits: SessionRateLimit[],
): string => {
  const live = agents.filter(isLive).length
  const parts = [
    agents.length === 0 ? 'nessun agente' : `agenti ${live}/${agents.length}`,
  ]
  for (const limit of limits) {
    parts.push(
      `${SHORT[limit.kind] ?? limit.kind} ${Math.round(limit.percentUsed)}%`,
    )
  }
  return parts.join(' · ')
}

// Aggiorna la voce nella status line e fa ridisegnare il pannello.
async function refresh($: Dollar): Promise<void> {
  const [agents, usage] = await Promise.all([$.agent.list(), $.session.usage()])
  $.ui.status(summarize(agents, usage.rateLimits))
  await update($, tick, n => n + 1)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agenti',
      description: 'Apre il pannello con gli agenti in uso e i limiti',
    })
    void $.ui.open({ id: PANE, title: 'Agenti e limiti' })
    await refresh($)

    return next(e)
  })

  on('command.run', { command: 'agenti' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agenti e limiti' })
    await refresh($)

    return { text: 'Pannello "Agenti e limiti" aperto.' }
  })

  // Un agente parte: dopo `next` esiste già nella lista.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    await refresh($)

    return started
  }).catch(($, e, next) => next(e))

  // Un turno finisce (anche quello di un sub-agente): lo stato può essere cambiato.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refresh($)

    return done
  })

  // Contesto, costo o una finestra di limite si sono mossi.
  on('session.measure', async ($, e, next) => {
    await refresh($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    await read($, tick) // iscrive il pannello: si ridisegna a ogni refresh

    const [agents, usage, now] = await Promise.all([
      $.agent.list(),
      $.session.usage(),
      $.clock.now(),
    ])
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 14)
    const live = agents.filter(isLive).length
    const { context, cost, rateLimits } = usage

    return (
      <Box flexDirection="column">
        <Text bold>
          Agenti: {live} attivi su {agents.length}
        </Text>
        {agents.length === 0 && (
          <Text dimColor>Nessun agente lanciato in questa sessione.</Text>
        )}
        {agents.slice(-room).map(a => (
          <Text key={a.id} dimColor={!isLive(a)}>
            {isLive(a) ? '●' : '○'} {a.type} · {STATUS[a.status] ?? a.status}
            {a.description ? ` · ${a.description}` : ''}
          </Text>
        ))}

        <Text> </Text>
        <Text bold>Limiti del piano</Text>
        {rateLimits.length === 0 && (
          <Text dimColor>
            Nessun dato: i limiti compaiono dopo la prima risposta e solo con
            un abbonamento.
          </Text>
        )}
        {rateLimits.map(limit => (
          <Text key={limit.kind}>
            {(WINDOW[limit.kind] ?? limit.kind).padEnd(18)}{' '}
            <Text color={levelOf(limit.percentUsed)}>
              {bar(limit.percentUsed)} {Math.round(limit.percentUsed)}%
            </Text>
            <Text dimColor> {resetsIn(limit.resetsAt, now)}</Text>
          </Text>
        ))}

        <Text> </Text>
        <Text bold>Sessione</Text>
        <Text>
          {'Contesto'.padEnd(18)}{' '}
          <Text color={levelOf(context.percent ?? 0)}>
            {bar(context.percent ?? 0)} {Math.round(context.percent ?? 0)}%
          </Text>
        </Text>
        {cost && <Text dimColor>Costo finora: ${cost.usd.toFixed(2)}</Text>}
      </Box>
    )
  })
}
