// Il contratto esporta solo tipi.
export type AgentMonitorTick = number

declare module 'claude-code' {
  interface PluginState {
    // `tick` non contiene dati: serve solo a far ridisegnare il pannello
    // quando cambia qualcosa (agenti, limiti, contesto).
    'agent-monitor': { tick: AgentMonitorTick }
  }
}
