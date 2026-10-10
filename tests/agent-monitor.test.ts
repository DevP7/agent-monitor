import { expect, mock, test } from 'claude-code/testing'

import { summarize } from '../hooks/register'

const PANE = {
  title: 'Agenti e limiti',
  isFocused: false,
  bodyColumns: 80,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
} as const

test('la status line riassume agenti e limiti', () => {
  expect(summarize([], [])).toBe('nessun agente')

  const agents = [
    { id: 'a', description: 'cerca', type: 'Explore', status: 'running' },
    { id: 'b', description: 'piano', type: 'Plan', status: 'completed' },
  ] as const
  const limits = [
    { kind: 'five_hour', percentUsed: 23.4 },
    { kind: 'seven_day', percentUsed: 41 },
  ]

  expect(summarize([...agents], limits)).toBe('agenti 1/2 · 5h 23% · 7g 41%')
})

test('il pannello mostra agenti e limiti su ogni superficie', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-10T12:00:00Z') })
  on('agent.list', () => ({
    value: [
      { id: 'a', description: 'cerca config', type: 'Explore', status: 'running' },
      { id: 'b', description: 'piano', type: 'Plan', status: 'completed' },
    ],
  }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200000, tokens: 82000, percent: 41 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 23.4, resetsAt: '2026-10-10T14:10:00Z' },
      ],
      cost: { usd: 0.42 },
    },
  }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'agent-monitor',
      surface,
      component: 'Pane',
      requestId: 'agent-monitor',
      props: PANE,
    })

    expect(await ui.find({ type: 'Text', text: /Agenti: 1 attivi su 2/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Finestra 5 ore.*23%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /reset tra 2 h 10 min/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Costo finora: \$0\.42/ })).toBeDefined()
    await ui.unmount()
  }
})
