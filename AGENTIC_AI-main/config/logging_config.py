"""
STUB — structured logging and OpenTelemetry trace setup. Will configure
Python's logging module for structured (JSON) output and initialize an
OTel TracerProvider used by src/observability/tracer.py.
"""
import logging


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
    )
    # TODO: replace with structured (JSON) formatter + OTel span exporter.
