"""backend/tests/unit/test_safe_subprocess.py

Unit tests for safe_subprocess service verifying Rule 4:
- Mandatory list arguments (forbids strings)
- Mandatory flags injection (-nostdin, -hide_banner, -protocol_whitelist file)
- Duration cap enforcement
"""

import pytest
from unittest.mock import patch, MagicMock

from backend.app.services.safe_subprocess import (
    SubprocessSecurityError,
    run_ffmpeg,
    run_ffprobe,
    run_safe_command,
)


def test_run_safe_command_rejects_string():
    """Commands passed as string instead of list must be rejected immediately."""
    with pytest.raises(SubprocessSecurityError) as exc_info:
        run_safe_command("ffmpeg -i input.mp4")  # Not a list!
    assert "Security Rule 4 Violation" in str(exc_info.value)


def test_run_safe_command_rejects_non_string_arguments():
    """Command arguments that are not strings must be rejected."""
    with pytest.raises(SubprocessSecurityError) as exc_info:
        run_safe_command(["ffmpeg", 1234, "-i", "input.mp4"])  # 1234 is int
    assert "Security Rule 4 Violation" in str(exc_info.value)


@patch("backend.app.services.safe_subprocess.subprocess.run")
def test_run_ffmpeg_injects_mandatory_flags(mock_run):
    """Verifies that FFmpeg automatically injects mandatory security flags."""
    mock_res = MagicMock()
    mock_res.returncode = 0
    mock_run.return_value = mock_res

    run_ffmpeg(["-i", "input.mp4", "output.wav"])

    assert mock_run.called
    called_cmd = mock_run.call_args[0][0]

    # Rule 4 flags
    assert "-nostdin" in called_cmd
    assert "-hide_banner" in called_cmd
    assert "-protocol_whitelist" in called_cmd
    assert "file" in called_cmd
    assert "-t" in called_cmd  # duration cap
    assert mock_run.call_args[1]["shell"] is False  # shell=False enforced


@patch("backend.app.services.safe_subprocess.subprocess.run")
def test_run_ffprobe_injects_mandatory_flags(mock_run):
    """Verifies that ffprobe automatically injects mandatory security flags."""
    mock_res = MagicMock()
    mock_res.returncode = 0
    mock_run.return_value = mock_res

    run_ffprobe(["input.mp4"])

    assert mock_run.called
    called_cmd = mock_run.call_args[0][0]
    assert "-hide_banner" in called_cmd
    assert "-protocol_whitelist" in called_cmd
    assert "file" in called_cmd
    assert mock_run.call_args[1]["shell"] is False
