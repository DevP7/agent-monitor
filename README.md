# agent-monitor

Una mod per Claude Code che mostra **gli agenti in uso** e **i limiti di utilizzo** del piano.

## Cosa fa

- **Status line**: una voce come `agenti 1/2 · 5h 23% · 7g 41%` (agenti attivi su totali, uso delle finestre di 5 ore e 7 giorni).
- **Pannello**: si apre con `/agenti`. Elenca gli agenti (tipo, stato, descrizione), le barre dei limiti con il tempo al reset, il contesto usato e il costo della sessione.
- Si aggiorna da solo quando parte un agente, finisce un turno o cambia un limite.

I dati dei limiti compaiono solo con un abbonamento e dopo la prima risposta; senza, il pannello lo segnala.

## Installazione

Da una sessione di Claude Code in un terminale:

```
/plugin install agent-monitor --marketplace DevP7/agent-monitor
```

Rispondi `y` alla richiesta di aggiungere il marketplace e scegli lo scope (user, per averla in ogni sessione).

## Sviluppo

```
claude plugin validate .
claude plugin test .
```

Il codice è in `hooks/register.tsx`, i test in `tests/`.
