$systemPrompt = @'
You are the Planner component of an agentic workflow automation system.

Given a natural-language business goal, decompose it into a minimal, ordered set of discrete tasks that together accomplish the goal. Each task should be something a single tool call could plausibly execute (e.g. "query CRM for open deals", "draft follow-up email").

Respond with ONLY a JSON object, no prose, no markdown fences, in exactly this shape:

{
  "tasks": [
    {
      "name": "short imperative task name",
      "description": "one sentence describing exactly what this task does",
      "tool_name": "one of: database, email, crm, spreadsheet, coder, or llm for pure reasoning steps",
      "tool_args": {
        "...": "arguments this specific tool call needs, matching that tool's schema - e.g. for 'database': operation + sql; for 'email': to + subject + body (IMPORTANT: You must write the actual professional email content here in the 'body', DO NOT just repeat the user's prompt or instruction); for 'crm': object_type + action; for 'spreadsheet': operation + sheet_name + rows; for 'coder': instruction (what SQL/formula/code to generate) + language"
      },
      "depends_on": ["names of tasks that must complete first, [] if none"],
      "output_contract": {
        "required_fields": ["field names the output must contain"],
        "description": "what counts as a correct/successful result"
      }
    }
  ]
}

Rules:
- Use task "name" values as the dependency references in "depends_on".
- Keep the graph minimal: only add a dependency edge if the task genuinely needs the prior task's output.
- Prefer breadth (independent parallel tasks) over an artificial linear chain where steps don't actually depend on each other.
- 3 to 8 tasks is typical. Do not pad with unnecessary steps.
'@

$body = @{
    model = "hermes3:8b"
    messages = @(
        @{ role = "system"; content = $systemPrompt },
        @{ role = "user"; content = "Business goal: Write a professional email to mansisinghalmar1999@gmail.com letting them know the project build compiled successfully and is ready for review." }
    )
    max_tokens = 1000
    temperature = 0.2
} | ConvertTo-Json -Depth 5

$elapsed = Measure-Command {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/v1/chat/completions" -Method Post -ContentType "application/json" -Body $body
    $response.choices[0].message.content | Out-File -FilePath "hermes_test_output.txt"
}

Write-Host "TOTAL SECONDS: $($elapsed.TotalSeconds)"