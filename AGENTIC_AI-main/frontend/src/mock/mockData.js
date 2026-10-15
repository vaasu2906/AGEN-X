export const templates = [
  {
    title: 'Invoice extraction & Sheets sync',
    description: 'Pull key details from invoices and keep your ledger up to date.',
    icon: 'file',
    prompt: 'Extract invoice number, vendor, due date, and total from new Gmail attachments, then add each invoice to my Google Sheets ledger. Ask me before writing any row.',
  },
  {
    title: 'Daily support email triage',
    description: 'Sort, summarize, and prioritize your incoming support.',
    icon: 'mail',
    prompt: 'Review today’s unread support emails, categorize them by urgency and topic, and draft a concise response for each. Do not send replies without my approval.',
  },
  {
    title: 'Competitive market research',
    description: 'Track competitor updates and turn findings into a brief.',
    icon: 'search',
    prompt: 'Research the latest product, pricing, and positioning updates from our top three competitors, then create a concise comparison brief with sources.',
  },
]

export const initialWorkflows = [
  {
    id: 'wf-8f2a91',
    goal: 'Summarize customer feedback from this week and flag recurring themes',
    status: 'COMPLETED',
    tokens: 2840,
    cost: 0.0142,
    createdAt: '2025-02-18T14:32:00.000Z',
    elapsed: 12.4,
    validationScore: 96,
    feedback: 'Summary is grounded in source messages. All recurring themes include supporting evidence.',
    logs: [
      { time: '14:32:01', type: 'system', text: 'Workflow initialized. 3 source steps planned.' },
      { time: '14:32:03', type: 'agent', text: 'MailReaderAgent: Retrieved 24 feedback messages.' },
      { time: '14:32:08', type: 'agent', text: 'DataExtractorAgent: Identified 4 recurring themes.' },
      { time: '14:32:13', type: 'success', text: 'CriticAgent: Verification passed with a score of 96/100.' },
    ],
    steps: [
      { id: 's1', role: 'PlannerAgent', tool: 'Workflow Engine', description: 'Identify and scope customer feedback sources', status: 'COMPLETED', risk: 'LOW' },
      { id: 's2', role: 'MailReaderAgent', tool: 'Gmail MCP', description: 'Retrieve this week’s customer feedback', status: 'COMPLETED', risk: 'LOW' },
      { id: 's3', role: 'DataExtractorAgent', tool: 'Web Searcher', description: 'Group messages into recurring themes', status: 'COMPLETED', risk: 'LOW' },
      { id: 's4', role: 'CriticAgent', tool: 'Verification Engine', description: 'Verify findings against source messages', status: 'COMPLETED', risk: 'LOW' },
    ],
  },
  {
    id: 'wf-3b7d04',
    goal: 'Extract key details from new invoices and prepare a ledger update',
    status: 'COMPLETED',
    tokens: 1960,
    cost: 0.0098,
    createdAt: '2025-02-18T11:08:00.000Z',
    elapsed: 9.8,
    validationScore: 92,
    feedback: 'All extracted fields matched the invoice source. Ledger changes were approved.',
    logs: [
      { time: '11:08:01', type: 'system', text: 'Workflow initialized. 4 steps planned.' },
      { time: '11:08:04', type: 'agent', text: 'MailReaderAgent: Found 3 invoice attachments.' },
      { time: '11:08:08', type: 'approval', text: 'Human approval received for ledger updates.' },
      { time: '11:08:12', type: 'success', text: 'CriticAgent: 3 of 3 invoice rows verified.' },
    ],
    steps: [
      { id: 's1', role: 'PlannerAgent', tool: 'Workflow Engine', description: 'Plan invoice extraction and ledger update', status: 'COMPLETED', risk: 'LOW' },
      { id: 's2', role: 'MailReaderAgent', tool: 'Gmail MCP', description: 'Find new invoice emails and attachments', status: 'COMPLETED', risk: 'LOW' },
      { id: 's3', role: 'DataExtractorAgent', tool: 'Document Parser', description: 'Extract invoice details and validate fields', status: 'COMPLETED', risk: 'LOW' },
      { id: 's4', role: 'SheetsAgent', tool: 'Google Sheets MCP', description: 'Add verified invoices to the ledger', status: 'COMPLETED', risk: 'HIGH' },
      { id: 's5', role: 'CriticAgent', tool: 'Verification Engine', description: 'Confirm ledger rows match source invoices', status: 'COMPLETED', risk: 'LOW' },
    ],
  },
  {
    id: 'wf-c9e420',
    goal: 'Prepare a daily briefing of product and industry news',
    status: 'FAILED',
    tokens: 740,
    cost: 0.0037,
    createdAt: '2025-02-17T09:15:00.000Z',
    elapsed: 4.2,
    validationScore: 0,
    feedback: 'One source could not be reached. The workflow stopped to avoid an incomplete briefing.',
    logs: [
      { time: '09:15:01', type: 'system', text: 'Workflow initialized. 3 source steps planned.' },
      { time: '09:15:04', type: 'error', text: 'WebSearchAgent: Source timed out after 3 attempts.' },
      { time: '09:15:05', type: 'error', text: 'Workflow halted. No briefing was sent.' },
    ],
    steps: [
      { id: 's1', role: 'PlannerAgent', tool: 'Workflow Engine', description: 'Plan daily news briefing', status: 'COMPLETED', risk: 'LOW' },
      { id: 's2', role: 'WebSearchAgent', tool: 'Web Searcher', description: 'Collect product and industry updates', status: 'FAILED', risk: 'LOW' },
      { id: 's3', role: 'CriticAgent', tool: 'Verification Engine', description: 'Verify briefing sources and summary', status: 'PENDING', risk: 'LOW' },
    ],
  },
]

export const tools = [
  { name: 'Gmail Connector', category: 'Communication', type: 'Read / Write', status: 'CONNECTED', description: 'Read, search, and draft email responses.', icon: 'mail', limit: '1,000 requests / day', sandbox: 'Draft-only sandbox enabled' },
  { name: 'Google Sheets', category: 'Productivity', type: 'Read / Write', status: 'CONNECTED', description: 'Read and update spreadsheet data.', icon: 'table', limit: '500 requests / day', sandbox: 'Approval required for writes' },
  { name: 'PostgreSQL', category: 'Database', type: 'Read / Write', status: 'CONNECTED', description: 'Query structured data with guarded access.', icon: 'database', limit: '60 queries / minute', sandbox: 'Read-only by default' },
  { name: 'Web Searcher', category: 'Research', type: 'Exec', status: 'CONNECTED', description: 'Search the web and return cited sources.', icon: 'search', limit: '100 searches / day', sandbox: 'Public sources only' },
]

export function makeWorkflow(goal) {
  const now = new Date()
  const id = `wf-${Math.random().toString(16).slice(2, 8)}`
  const search = /research|competitor|market|search|news/i.test(goal)
  const email = /email|mail|support|reply|invoice/i.test(goal)
  const steps = [
    { id: 's1', role: 'PlannerAgent', tool: 'Workflow Engine', description: 'Break the goal into safe, verifiable actions', status: 'PENDING', risk: 'LOW' },
    ...(email ? [{ id: 's2', role: 'MailReaderAgent', tool: 'Gmail MCP', description: 'Find and read the relevant email sources', status: 'PENDING', risk: 'LOW' }] : []),
    { id: email ? 's3' : 's2', role: search ? 'WebSearchAgent' : 'DataExtractorAgent', tool: search ? 'Web Searcher' : 'Document Parser', description: search ? 'Gather current information from trusted sources' : 'Extract and organize the requested information', status: 'PENDING', risk: 'LOW' },
    ...( /sheet|ledger|write|update|send|create|add/i.test(goal) ? [{ id: 's4', role: /email|send|reply/i.test(goal) ? 'MailWriterAgent' : 'SheetsAgent', tool: /email|send|reply/i.test(goal) ? 'Gmail MCP' : 'Google Sheets MCP', description: /email|send|reply/i.test(goal) ? 'Prepare an email response for delivery' : 'Prepare requested data changes', status: 'PENDING', risk: 'HIGH' }] : []),
    { id: 's5', role: 'CriticAgent', tool: 'Verification Engine', description: 'Check the result for accuracy and completeness', status: 'PENDING', risk: 'LOW' },
  ]
  return {
    id, goal, status: 'RUNNING', tokens: 0, cost: 0, createdAt: now.toISOString(), elapsed: 0,
    validationScore: 0, feedback: 'Waiting for the workflow to complete.',
    logs: [{ time: now.toLocaleTimeString([], { hour12: false }), type: 'system', text: 'Workflow initialized. Agent plan generated.' }],
    steps,
  }
}
