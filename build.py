#!/usr/bin/env python3
"""Build the dashboard and local server; never starts hardware discovery."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent


def executable(name):
    found = shutil.which(name)
    if not found:
        raise SystemExit(f"Missing {name} in PATH. See README.md.")
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", action="store_true", help="optimized server build")
    parser.add_argument("--skip-install", action="store_true", help="reuse installed UI dependencies")
    args = parser.parse_args()
    node, cargo = executable("node"), executable("cargo")
    ui = ROOT / "app" / "ui"
    if not args.skip_install:
        subprocess.run([executable("pnpm"), "install", "--frozen-lockfile"], cwd=ui, check=True)
    subprocess.run([node, "node_modules/typescript/bin/tsc", "-b"], cwd=ui, check=True)
    subprocess.run([node, "node_modules/vite/bin/vite.js", "build"], cwd=ui, check=True)
    cmd = [cargo, "build", "--locked", "-p", "p56-server"]
    if args.release:
        cmd.append("--release")
    subprocess.run(cmd, cwd=ROOT, check=True)
    suffix = ".exe" if os.name == "nt" else ""
    target = Path(os.environ.get("CARGO_TARGET_DIR", "target"))
    if not target.is_absolute():
        target = ROOT / target
    built = target / ("release" if args.release else "debug") / ("p56-server" + suffix)
    dest = ROOT / "bin" / ("pz65-server" + suffix)
    dest.parent.mkdir(exist_ok=True)
    # Replace the file atomically, also when the previous binary is running on Unix.
    temporary = dest.with_name(dest.name + ".new")
    shutil.copy2(built, temporary)
    temporary.replace(dest)
    print(f"Built: {dest}\nPreview: python3 launch.py --preview")


if __name__ == "__main__":
    main()
