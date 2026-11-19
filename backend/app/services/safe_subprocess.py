"""backend/app/services/safe_subprocess.py

Safe subprocess execution service adhering to Rule 4:
- shell=False enforced unconditionally
- Arguments strictly passed as lists of strings
- Mandatory FFmpeg flags: -nostdin -hide_banner -protocol_whitelist file
- Strict execution timeouts and duration caps
- Prevents command injection and unconstrained resource consumption
"""

import os
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional


def find_executable(name: str) -> str:
    """Finds an executable in PATH or standard installation fallback locations."""
    # 1. Standard PATH
    found = shutil.which(name)
    if found:
        return found

    # 2. Check User PATH from environment/registry fallback on Windows
    localappdata = os.environ.get("LOCALAPPDATA", "")
    if localappdata:
        winget_pattern = Path(localappdata) / "Microsoft" / "WinGet" / "Packages"
        if winget_pattern.exists():
            for p in winget_pattern.glob(f"**/{name}.exe"):
                if p.is_file():
                    return str(p)

    return name


class SubprocessSecurityError(Exception):
    """Raised when a command violates subprocess security constraints."""
    pass


class SubprocessTimeoutError(Exception):
    """Raised when a subprocess exceeds its assigned execution timeout."""
    pass


def run_safe(
    cmd: List[str],
    timeout: int = 60,
    cwd: Optional[str] = None
) -> subprocess.CompletedProcess:
    """
    Executes a subprocess under strict security constraints (Rule 4).
    Enforces shell=False, list-only arguments, text output, and timeout.
    """
    if not isinstance(cmd, list):
        raise SubprocessSecurityError(
            f"Security Rule 4 Violation: Commands must be provided as a list of arguments, got {type(cmd).__name__}"
        )

    for i, arg in enumerate(cmd):
        if not isinstance(arg, str):
            raise SubprocessSecurityError(
                f"Security Rule 4 Violation: Command argument {i} must be a string, got {type(arg).__name__}"
            )

    try:
        return subprocess.run(
            cmd,
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd
        )
    except subprocess.TimeoutExpired as e:
        raise SubprocessTimeoutError(
            f"Subprocess exceeded execution timeout of {timeout}s: {' '.join(cmd[:3])}..."
        ) from e


def run_safe_command(
    cmd: List[str],
    timeout_sec: float = 60.0,
    check: bool = True,
    capture_output: bool = True,
    cwd: Optional[str] = None
) -> subprocess.CompletedProcess:
    """
    Executes a subprocess with check support and security constraints.
    """
    if not isinstance(cmd, list):
        raise SubprocessSecurityError(
            f"Security Rule 4 Violation: Commands must be provided as a list of arguments, got {type(cmd).__name__}"
        )

    for i, arg in enumerate(cmd):
        if not isinstance(arg, str):
            raise SubprocessSecurityError(
                f"Security Rule 4 Violation: Command argument {i} must be a string, got {type(arg).__name__}"
            )

    try:
        result = subprocess.run(
            cmd,
            shell=False,
            check=check,
            capture_output=capture_output,
            text=True,
            timeout=timeout_sec,
            cwd=cwd
        )
        return result
    except subprocess.TimeoutExpired as e:
        raise SubprocessTimeoutError(
            f"Subprocess exceeded execution timeout of {timeout_sec}s: {' '.join(cmd[:3])}..."
        ) from e


def ffmpeg_base_cmd(executable: str = "ffmpeg") -> List[str]:
    """Returns base command list with mandatory security flags injected."""
    resolved = find_executable(executable) if executable in ("ffmpeg", "ffprobe") else executable
    return [resolved, "-nostdin", "-hide_banner", "-protocol_whitelist", "file"]


def run_ffmpeg(
    args: List[str],
    timeout_sec: float = 120.0,
    max_duration_sec: Optional[float] = 300.0,
    executable: str = "ffmpeg"
) -> subprocess.CompletedProcess:
    """
    Executes FFmpeg with mandatory security flags and duration cap.
    Injects: -nostdin, -hide_banner, -protocol_whitelist file
    """
    if not isinstance(args, list):
        raise SubprocessSecurityError("FFmpeg arguments must be provided as a list")

    resolved_bin = find_executable(executable) if executable == "ffmpeg" else executable
    mandatory_flags = ["-nostdin", "-hide_banner"]
    cmd = [resolved_bin]

    for flag in mandatory_flags:
        if flag not in args:
            cmd.append(flag)

    # Ensure protocol whitelist is set
    if "-protocol_whitelist" not in args:
        cmd.extend(["-protocol_whitelist", "file"])

    # Duration cap to prevent resource exhaustion
    if max_duration_sec is not None and "-t" not in args:
        cmd.extend(["-t", str(max_duration_sec)])

    cmd.extend(args)
    return run_safe_command(cmd, timeout_sec=timeout_sec)


def run_ffprobe(
    args: List[str],
    timeout_sec: float = 30.0,
    executable: str = "ffprobe"
) -> subprocess.CompletedProcess:
    """
    Executes ffprobe with mandatory security flags.
    Injects: -hide_banner, -protocol_whitelist file
    """
    if not isinstance(args, list):
        raise SubprocessSecurityError("ffprobe arguments must be provided as a list")

    resolved_bin = find_executable(executable) if executable == "ffprobe" else executable
    cmd = [resolved_bin, "-hide_banner"]
    if "-protocol_whitelist" not in args:
        cmd.extend(["-protocol_whitelist", "file"])

    cmd.extend(args)
    return run_safe_command(cmd, timeout_sec=timeout_sec)
