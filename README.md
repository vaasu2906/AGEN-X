# Agentic AI Workflow Automation

## Status by objective

| # | Objective | Status |
|---|-----------|--------|
| 1 | Modular Planner–Executor–Critic Architecture | ✅ Implemented & tested |
| 2 | Pluggable Tool & API Integration Layer | ✅ Implemented & tested (real, local connectors) |
| 3 | Hybrid Memory Subsystem | 🔲 Not started |
| 4 | Stateful Orchestration Engine | 🟡 Checkpointing/resume work (via LangGraph); branching, parallel execution, retry-with-backoff not started |
| 5 | Self-Verification and Recovery | 🟡 Contract verification + optional LLM-judge work; automatic re-planning hook is not implemented |
| 6 | Horizontal Scalability | 🔲 Not started |
| 7 | Observability and Auditability | 🔲 Not started |
| 8 | Rigorous Evaluation | 🔲 Not started (depends on 2–5) |
| 9 | Sovereign model layer (Hermes 3 / Qwen2.5-Coder / DeepSeek-Coder-V2 via Ollama/vLLM) | ✅ Implemented & tested (role-routed gateway, real local connectors, deterministic fallback) |

**37/37 unit tests pass. Both demo scripts run end-to-end with zero setup**
(no API key, no GPU, no external accounts) because Objective 2's connectors
are real, local implementations rather than mocks, and Objective 9's model
gateway falls back to the same deterministic decomposition used before if
no local model server is reachable — see "What 'real' means here" and
"Sovereign Model Layer" below.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

That's it. No API key, no database server, no cloud account, and no GPU
is required to run the demo.

## Run it

```bash
# Hand-rolled Planner -> Executor -> Critic loop
python -m examples.demo_run
python -m examples.demo_run "Onboard a new enterprise client and update the CRM"

# Same pipeline, orchestrated as a LangGraph StateGraph with real
# per-node checkpointing (see "LangChain / LangGraph" below)
python -m examples.demo_langgraph_run

# Tests
pytest tests/unit/ -v
```

Each run creates a `data/` folder (gitignored) holding the local SQLite
database, the CRM JSON store, the email outbox, and the spreadsheet
workbook — open any of them after a run to show real state changed, not
just console output.

## What "real" means here (Objective 2)

The five connectors under `src/tools/connectors/` are genuine, working
implementations, not stubs — just backed by local files/models instead of
paid third-party accounts, since this project can't assume the person
running it has (or can pay for) live API access:

| Tool name | Backend | What it actually does |
|---|---|---|
| `database` | SQLite (`data/agentic.db`) | Runs real SQL against a seeded `invoices` table |
| `email` | Local JSONL outbox (`data/outbox.jsonl`) | Writes a real message record; swaps to real SMTP automatically if `SMTP_HOST` etc. are set as env vars |
| `crm` | JSON store (`data/crm.json`) | CRUD against contact/deal records, same shape a Salesforce/HubSpot client call would take |
| `spreadsheet` | `.xlsx` via openpyxl (`data/workbook.xlsx`) | Reads/writes a real Excel workbook |
| `coder` | Sovereign Model Layer, `coder` role | Generates SQL/formula/code snippets via Qwen2.5-Coder or DeepSeek-Coder-V2; falls back to a TODO stub with no local model running |

Swapping any of these for the live equivalent (Postgres, SendGrid,
Salesforce, Google Sheets API) means rewriting that one file's `run()`
method — the `BaseTool` interface, the registry, and `ExecutorAgent` don't
change. That pluggability is the actual point of Objective 2, and it's
demonstrated, not just described.

New tools are added **declaratively** — see `config/tools_config.json`.
Adding another connector means adding one entry there, not touching any
agent code.

## Sovereign Model Layer (Objective 9)

The paper's Section 4 replaces a single hosted-API call with a **role-routed
gateway** (`src/llm/gateway.py`) to locally hosted, open-weight models
served through [Ollama](https://ollama.com) or [vLLM](https://github.com/vllm-project/vllm),
so no prompt ever leaves the machine and there's no per-token fee:

| Role | Primary model | Fallback | Used by |
|---|---|---|---|
| `planner` | Hermes 3 70B | Hermes 3 8B | `PlannerAgent` — decomposes a goal into a task graph |
| `critic` | Hermes 3 70B | Hermes 3 8B | `CriticAgent`'s LLM-judge — **on by default** in both engines (non-binding; deterministic checks are always authoritative) |
| `extractor` | Hermes 3 8B | — | the `extractor` tool — pulls structured field values out of free-text source material |
| `coder` | Qwen2.5-Coder-32B | DeepSeek-Coder-V2-Lite | the `coder` tool — SQL/formula/code generation |

All four roles now have real calling code, and the deterministic planner
fallback (used when no local model is reachable, and in tests) actually
exercises `coder` and `extractor` automatically: a goal that mentions a
query/report/formula/script emits a `generate_query_or_formula` task, and
a goal that mentions extracting/parsing fields emits an `extract_fields`
task — see `PlannerAgent._decompose_fallback()`. Previously only
`planner` was ever invoked in a normal run; this closed that gap.

The routing table lives in `config/llm_routing.yaml`; edit it (or the
`OLLAMA_BASE_URL` / `VLLM_BASE_URL` / `LLM_BACKEND_PRIORITY` env vars in
`.env`) to point at whatever you have pulled/served locally.

### Turning it on

```bash
# 1. Install Ollama: https://ollama.com
# 2. Pull the models this project routes to:
ollama pull hermes3:70b          # or hermes3:8b on smaller hardware
ollama pull qwen2.5-coder:32b
ollama pull deepseek-coder-v2:lite

# 3. Start the server (defaults to http://localhost:11434)
ollama serve

# 4. Run the demo as normal - PlannerAgent now routes through Hermes 3
#    instead of its keyword fallback, and the `coder` tool actually
#    generates SQL instead of a TODO stub.
python -m examples.demo_run "Onboard a new enterprise client"
```

vLLM is the production path (continuous batching, higher throughput under
concurrent workflows); Ollama is the developer path for laptops and small
servers. Both expose the same OpenAI-compatible `/v1/chat/completions`
route, which is the one interface the gateway calls — swap one for the
other by changing `LLM_BACKEND_PRIORITY`, no code changes.

### Zero-setup behaviour (no server running)

If no local model answers, `ModelGateway.generate()` raises
`LLMUnavailableError` — exactly what the old single-model `LLMClient` did
— so:
- `PlannerAgent` falls back to its keyword-driven deterministic
  decomposition (unchanged from before).
- `CriticAgent`'s optional LLM-judge is simply skipped; deterministic
  contract checks still run.
- the `coder` tool returns a clearly-marked `-- TODO (...)` stub instead
  of failing the task.

This is why the demo still runs end-to-end with zero setup even though
the model layer is "on" by default.

### Optional cloud dev fallback

Sovereignty is the default (no component calls an external endpoint
unless you ask it to). If you're iterating on this project without a
local GPU, set both:

```bash
AGENTIC_ALLOW_CLOUD_FALLBACK=1
ANTHROPIC_API_KEY=sk-ant-...
```

in `.env`, and the gateway will use a hosted Claude model as a last
resort *only* when no local Ollama/vLLM backend is reachable. A bare
`ANTHROPIC_API_KEY` with no `AGENTIC_ALLOW_CLOUD_FALLBACK=1` does nothing.

### Not implemented: the SWE-agent module

The paper's Section 6 specifies a prospective SWE-agent Executor
(Docker-sandboxed repository maintenance, an Agent-Computer Interface,
auditable pull requests) that runs code-centric work through the same
`coder` role. The paper itself labels this "a planned extension...
specified here but not yet implemented or measured," so it's out of scope
for this pass; the `coder` tool covers the other code-generation use case
the paper names (SQL/formula generation for Executors) instead.

## LangChain / LangGraph

- `src/tools/langchain_adapter.py` wraps every registered connector as a
  LangChain `StructuredTool`, so the same registry can be handed to a
  LangChain agent without writing a second set of tool definitions.
- `src/orchestrator/langgraph_engine.py` re-implements the Planner →
  Executor → Critic loop as a compiled LangGraph `StateGraph`
  (`plan → execute → critic → [end | replan]`) using LangGraph's
  `MemorySaver` checkpointer. This gives genuine per-node checkpoint/resume
  by `thread_id`, which is more complete than the hand-rolled engine's
  end-of-run-only checkpoint (see the Objective 4 caveat below).

Both engines share the same `PlannerAgent`, `ExecutorAgent`, `CriticAgent`,
and tool registry — they're two orchestration strategies over the same
agent stack, not two separate implementations.

## Dashboard & Automations

`frontend/` is a React + Tailwind single-page app talking to the FastAPI
backend's `/api/*` routes (`src/api/routes.py`). It's built and mounted at
`/` by the FastAPI server itself, so the whole thing runs from one command:

```bash
pip install -r requirements.txt fastapi uvicorn
cd frontend && npm install && npm run build && cd ..
uvicorn src.api.main:app --reload
# open http://127.0.0.1:8000/
```

(`src/api/static/` already ships a built copy, so `uvicorn src.api.main:app`
works out of the box without the build step — rebuild it after touching
anything in `frontend/`.)

The dashboard has two tabs:

- **Console** — the goal composer, live task graph, run history, log
  panel, and a read-only view into the actual local files each connector
  wrote to (`data/agentic.db`, `data/crm.json`, `data/outbox.jsonl`,
  `data/workbook.xlsx`). This is a manual "type a goal, watch it run" flow.
- **Automations** — hands a goal to `src/orchestrator/scheduler.py`'s
  `AutomationScheduler` instead: give it a goal and an interval, and it
  fires the exact same Planner → Executor → Critic loop itself, on that
  cadence, with nobody clicking anything. Each firing lands in the normal
  run history (`GET /api/runs`) like a manual run — there's no separate
  "automation run" concept, just a clock instead of a click starting
  `WorkflowEngine.run()`. Backed by a single background thread and a JSON
  snapshot (`data/automations.json`) so it survives a server restart
  without pulling in a real job queue; swapping in Celery/RQ (the stubs
  already present in `src/api/workers/`) is the natural next step for a
  production deployment, the same "swap the backend, keep the interface"
  pattern the rest of this project follows.

## Layout

```
config/
├── settings.py          environment/config loader
├── llm_routing.yaml       Sovereign Model Layer routing table (Objective 9)
└── tools_config.json     declarative tool registry (Objective 2)
src/
├── agents/
│   ├── base.py            BaseAgent interface
│   ├── planner.py          PlannerAgent (gateway-backed LLM path + fallback)  [Obj 1, 9]
│   ├── executor.py         ExecutorAgent                                       [Obj 1]
│   ├── critic.py           CriticAgent (contract verification + LLM-judge, on by default) [Obj 1, 9]
│   └── specialized/         reporter.py                                        [not started]
├── orchestrator/
│   ├── graph.py            Task/TaskGraph, DAG validation, topo sort [Obj 1]
│   ├── engine.py            WorkflowEngine (hand-rolled P-E-C loop)   [Obj 1]
│   ├── langgraph_engine.py  LangGraph StateGraph version of the loop  [Obj 4 partial]
│   ├── scheduler.py         AutomationScheduler - runs a goal on a repeating interval,
│   │                        with no manual trigger per run (backs the frontend's
│   │                        Automations tab)
│   └── state.py             RunState + in-memory RunStateStore
├── tools/
│   ├── base_tool.py         BaseTool interface                       [Obj 2]
│   ├── registry.py          ToolRegistry                             [Obj 2]
│   ├── bootstrap.py          builds the registry from tools_config.json [Obj 2]
│   ├── langchain_adapter.py  BaseTool -> LangChain StructuredTool
│   └── connectors/           database, email, crm, spreadsheet, coder, extractor -
│                              real, working [Obj 2, 9]
├── memory/                  session_memory.py, vector_store.py       [not started]
├── governance/               approval_gate.py, rbac.py                [not started]
├── observability/            tracer.py, cost_meter.py, audit_logger.py [not started]
├── api/                      FastAPI app + routes - runs/tools/data endpoints,
│                              automations CRUD, serves the built React+Tailwind
│                              frontend (see frontend/) - real, working. Celery
│                              workers (api/workers/) are still stubs.
└── llm/
    ├── client.py             single-provider client (Anthropic) - used as the
    │                          optional opt-in cloud dev fallback
    └── gateway.py             ModelGateway - role-routed Sovereign Model Layer [Obj 9]

tests/
├── unit/          37 passing tests (graph, planner, executor/critic, connectors,
│                   LangGraph engine, LLM gateway routing/fallback)
├── integration/    not started
└── benchmarks/      not started - Objective 8, needs Objectives 2-5 further along

examples/
├── demo_run.py             hand-rolled engine, runnable end-to-end
└── demo_langgraph_run.py    LangGraph engine, runnable end-to-end

docker/            Dockerfile + docker-compose.yml (present but not wired to anything yet)

```

## Honest caveats for your presentation

If asked what's not done:

- **Checkpointing/resume**: the hand-rolled engine (`engine.py`) only
  saves state at the *end* of a run. `langgraph_engine.py` checkpoints
  after every node via LangGraph, which is real mid-run resumability -
  point to that as the answer if asked to demonstrate resumability.
- **Conditional branching, parallel execution, retry-with-backoff**
  (rest of Objective 4): not implemented. `TaskGraph.ready_tasks()`
  already exposes which tasks are safe to run concurrently - that's the
  hook a thread/async pool would consume.
- **Automatic re-planning** (Objective 5): `CriticAgent.suggest_replan()`
  is a real method with a real signature, called from both engines, but
  it currently returns `None` (no re-plan) - turning verification issues
  into a targeted re-planning prompt is not implemented.
- **Objectives 3, 6, 7, 8**: not started. The module folders exist
  (`memory/`, `api/`, `observability/`) but contain stub files.
- **SWE-agent module** (Section 6 of the paper): the Docker-sandboxed
  repository-maintenance Executor is explicitly future work in the paper
  itself and is not implemented here. `src/tools/connectors/coder_connector.py`
  covers the other code-generation use case the paper names instead
  (SQL/formula generation via the `coder` role).
- **Automations** (`orchestrator/scheduler.py`): a single background
  thread, in-process — if the server restarts mid-tick a firing can be
  missed (schedules resume from wherever `next_run_at` was last saved,
  they don't "catch up" on missed firings), and it doesn't survive a
  multi-process/multi-worker deployment without a shared job queue
  (Celery/RQ, whose stub already lives in `src/api/workers/`). Fine for a
  single demo instance; not production job-scheduling infrastructure.
- **Model benchmarking** (paper Section 4.8): no throughput/latency/JSON-
  validity numbers have been measured for Hermes 3 / Qwen2.5-Coder /
  DeepSeek-Coder-V2 on this hardware - the gateway routes to them
  correctly (see tests/unit/test_llm_gateway.py) but nobody has run them
  side-by-side yet.

## Recommended build order (if continuing this project)

1. Implement `CriticAgent.suggest_replan()` so failed contract checks
   produce a real re-planning prompt (Objective 5).
2. Add parallel execution in `ExecutorAgent` using `graph.ready_tasks()`
   plus retry-with-backoff around `run_task()` (rest of Objective 4).
3. Session memory (Redis) is lower-risk than the vector store - build it
   first, wire into `PlannerAgent.decompose()` (Objective 3).
4. Objectives 6 & 7 are additive wrappers (API/queue layer, tracing) -
   they don't require changing 1-5.
5. Objective 8 (benchmark evaluation) only once 2-5 produce enough real,
   non-mock executions to compare against a manual/RPA baseline.
