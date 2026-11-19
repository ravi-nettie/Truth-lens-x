"""backend/app/services/job_runner.py

Background job execution runner for TruthLens X.
Uses a ThreadPoolExecutor to run CPU-bound forensic pipelines asynchronously.
"""

from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any, Callable

# Thread pool for offline CPU background tasks
executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="truthlens_worker")


def submit_job(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> Future:
    """Submits a callable to the background thread pool."""
    return executor.submit(fn, *args, **kwargs)

