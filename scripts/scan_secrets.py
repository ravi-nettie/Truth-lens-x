import subprocess
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

PATTERNS = [
    (re.compile(r"AIza[0-9A-Za-z-_]{35}"), "Google API Key"),
    (re.compile(r"sk-[a-zA-Z0-9]{20,}"), "OpenAI Secret Key"),
    (re.compile(r"gh[pous]_[0-9a-zA-Z]{36,}"), "GitHub Personal Token"),
    (re.compile(r"github_pat_[0-9a-zA-Z_]{82}"), "GitHub Fine-Grained Token"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS Access Key ID"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "Private Key Header"),
    (re.compile(r"""(?:api[_-]?key|auth_token|access_token|secret_key)\s*[:=]\s*['"][A-Za-z0-9_\-\.]{16,}['"]""", re.IGNORECASE), "Generic Hardcoded Secret/Token"),
]

def scan_tracked_files():
    tracked = subprocess.check_output(["git", "ls-files"], cwd=REPO_ROOT, text=True).splitlines()
    findings = []
    
    for rel_path in tracked:
        file_path = REPO_ROOT / rel_path
        if not file_path.is_file():
            continue
            
        # Ignore binary files or sample images
        if rel_path.endswith((".jpg", ".png", ".mp4", ".wav", ".ico", ".bin", ".safetensors")):
            continue
            
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
            for pattern, desc in PATTERNS:
                matches = pattern.findall(content)
                for m in matches:
                    # Filter out placeholders
                    m_lower = m.lower()
                    if any(ph in m_lower for ph in ["your_", "placeholder", "dummy", "example", "my_token"]):
                        continue
                    findings.append((rel_path, desc))
        except Exception:
            pass
            
    return findings

def scan_git_history():
    try:
        log_diff = subprocess.check_output(["git", "log", "-p"], cwd=REPO_ROOT, text=True, errors="ignore")
    except Exception:
        return []
        
    findings = []
    for pattern, desc in PATTERNS:
        matches = pattern.findall(log_diff)
        for m in matches:
            m_lower = m.lower()
            if any(ph in m_lower for ph in ["your_", "placeholder", "dummy", "example", "my_token"]):
                continue
            findings.append(("git history (commits)", desc))
            
    return findings

if __name__ == "__main__":
    print("=" * 60)
    print("Scanning repository for hardcoded secrets, tokens, and keys...")
    print("=" * 60)
    
    file_findings = scan_tracked_files()
    history_findings = scan_git_history()
    
    all_findings = set(file_findings + history_findings)
    if not all_findings:
        print("[SUCCESS] Zero secrets, credentials, API keys, or private tokens detected!")
        sys.exit(0)
    else:
        print(f"[ALERT] Found {len(all_findings)} potential secret(s):")
        for loc, desc in all_findings:
            print(f"  - Location: {loc} | Category: {desc}")
        sys.exit(1)
