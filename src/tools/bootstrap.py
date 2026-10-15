"""
Builds the default ToolRegistry from config/tools_config.json.

This is the "declarative, no core-logic changes" part of the integration
layer: adding a new application means adding an entry to that JSON file
(module + class + registered name), not editing ExecutorAgent, the
registry, or any agent code. See registry.py for the registry itself.
"""
from __future__ import annotations

import importlib
import json
from pathlib import Path
from typing import Any, Dict

from src.tools.registry import ToolRegistry

CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "tools_config.json"


def load_tool_config(config_path: Path | str = CONFIG_PATH) -> Dict[str, Any]:
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_registry_from_config(config_path: Path | str = CONFIG_PATH) -> ToolRegistry:
    config = load_tool_config(config_path)
    registry = ToolRegistry()

    for entry in config.get("tools", []):
        module = importlib.import_module(entry["module"])
        tool_cls = getattr(module, entry["class"])
        tool_instance = tool_cls()
        registry.register(tool_instance)

    return registry


def build_default_registry() -> ToolRegistry:
    """Convenience wrapper used by WorkflowEngine and the demo scripts."""
    return build_registry_from_config()
