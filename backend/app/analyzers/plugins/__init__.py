"""backend/app/analyzers/plugins package."""
from backend.app.analyzers.plugins.detector_hook import run_optional_detector, is_detector_enabled

__all__ = ["run_optional_detector", "is_detector_enabled"]
