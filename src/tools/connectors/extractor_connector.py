"""
ExtractorConnector, registered under tool name "extractor".

This is the runnable slice of the paper's field/document extraction role
(Section 4.4: Hermes 3 8B serving the "extractor" role for pulling
structured values - names, amounts, dates, entities - out of free-form
source text such as an email body, a note, or a scraped page). Before
this connector existed, "extractor" was a routing-table entry in
config/llm_routing.yaml with no calling code anywhere in the project;
this closes that gap the same way coder_connector.py closed it for the
"coder" role.

Like every other connector, it never fails the run with zero setup: if
no local extractor model is reachable (src/llm/gateway.py raises
LLMUnavailableError), it returns a clearly-marked null-valued result
instead of raising, the same "runs with nothing configured" contract the
rest of the project follows.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.llm.client import LLMUnavailableError
from src.llm.gateway import ModelGateway
from src.tools.base_tool import BaseTool, ToolSchema

EXTRACTOR_SYSTEM_PROMPT = """You are the Extractor role of an agentic \
workflow automation system. You are given a list of field names and a \
block of source text. Pull the value of each field out of the text. \
Respond with ONLY a JSON object mapping every field name to its \
extracted value (a string), or null if that field genuinely isn't \
present in the text. No prose, no markdown fences, no extra keys."""


class ExtractorConnector(BaseTool):
    name = "extractor"
    schema = ToolSchema(
        input_fields=["text", "fields"],
        output_fields=["fields", "generated_by"],
    )

    def __init__(self, gateway: Optional[ModelGateway] = None):
        self.gateway = gateway or ModelGateway(role="extractor")

    def run(self, args: Dict[str, Any]) -> Dict[str, Any]:
        text = (args.get("text") or "").strip()
        fields: List[str] = args.get("fields") or []
        if not text:
            raise ValueError("ExtractorConnector requires non-empty 'text'.")
        if not fields:
            raise ValueError("ExtractorConnector requires a non-empty 'fields' list.")

        try:
            response = self.gateway.generate(
                role="extractor",
                system=EXTRACTOR_SYSTEM_PROMPT,
                user=f"Fields to extract: {fields}\n\nText:\n{text}",
            )
            parsed = ModelGateway.extract_json(response.text)
            # Guarantee every requested field is present in the result,
            # even if the model omitted one, so the Critic's contract
            # check (required_fields=["fields"]) has something reliable
            # to look at regardless of model quality.
            extracted = {f: parsed.get(f) for f in fields}
            return {
                "fields": extracted,
                "generated_by": (response.raw or {}).get("model", "extractor"),
            }
        except (LLMUnavailableError, ValueError):
            # Deterministic fallback so the pipeline still runs end-to-end
            # with no Ollama/vLLM server up - mirrors CoderConnector's
            # fallback rather than failing the task outright. `ValueError`
            # also covers extract_json() failing to parse a malformed
            # model response.
            return {
                "fields": {f: None for f in fields},
                "generated_by": "fallback",
            }
