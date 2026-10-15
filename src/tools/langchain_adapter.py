"""
Wraps this project's BaseTool connectors as LangChain StructuredTool
objects, so the same registry (tools/registry.py, tools/bootstrap.py) can
be handed to LangChain/LangGraph-based agents without writing a second
set of tool definitions.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Type

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field, create_model

from src.tools.base_tool import BaseTool
from src.tools.registry import ToolRegistry


def _args_schema_for(tool: BaseTool) -> Type[BaseModel]:
    """Builds a permissive Pydantic model from a tool's declared input
    fields. Every field is optional so LangChain agents that don't know
    every parameter up front still get a valid call."""
    fields: Dict[str, Any] = {
        field_name: (Optional[Any], Field(default=None))
        for field_name in tool.schema.input_fields
    }
    model_name = f"{tool.name.capitalize()}Args"
    return create_model(model_name, **fields)  # type: ignore[call-overload]


def to_langchain_tool(tool: BaseTool) -> StructuredTool:
    def _invoke(**kwargs: Any) -> Dict[str, Any]:
        args = {k: v for k, v in kwargs.items() if v is not None}
        return tool.run(args)

    description = (
        f"{tool.name} tool. Accepts: {', '.join(tool.schema.input_fields) or 'no args'}. "
        f"Returns: {', '.join(tool.schema.output_fields) or 'a result dict'}."
    )

    return StructuredTool.from_function(
        func=_invoke,
        name=tool.name,
        description=description,
        args_schema=_args_schema_for(tool),
    )


def registry_to_langchain_tools(registry: ToolRegistry) -> List[StructuredTool]:
    return [to_langchain_tool(registry.get(name)) for name in registry.list_available()]
