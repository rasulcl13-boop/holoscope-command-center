#!/usr/bin/env python3
"""Run the locally built PZ65 adaptation. Does not send power/media commands."""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
NAMES = ['3D-PZ65-2048*1576-06272470', '3D-PZ65-2048*1576-25057492', '3D-PZ65-2048*1576-29676722']
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

def state(port):
    return json.load(opener.open(f'http://127.0.0.1:{port}/api/state', timeout=2))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--background', action='store_true')
    parser.add_argument('--preview', action='store_true', help='isolated virtual fan on loopback')
    args = parser.parse_args()
    port = 8766 if args.preview and args.port == 8765 else args.port
    try:
        existing = state(port)
    except (OSError, ValueError, urllib.error.URLError):
        existing = None
    if existing is not None:
        print(f'На порту {port} уже работает контроллер: http://127.0.0.1:{port}/')
        return
    binary = ROOT / 'bin' / ('pz65-server.exe' if os.name == 'nt' else 'pz65-server')
    if not binary.exists():
        raise SystemExit('Нет собранного сервера. Выполни python3 build.py — см. README.md')
    logs = ROOT / 'logs'
    logs.mkdir(exist_ok=True)
    stamp = datetime.datetime.now().astimezone().strftime('%Y%m%d-%H%M%S')
    journal = logs / f'{stamp}.jsonl'
    cmd = [str(binary), '--http-port', str(port), '--journal-file', str(journal), '--thumb-dir', str(ROOT / 'thumbs')]
    if args.preview:
        cmd += ['--tcp-port', '16666', '--ip', '127.0.0.1', '--simulate', '--sim-udp-port', '0']
    else:
        for name in NAMES:
            cmd += ['--fan-name-allow', name]
    env = os.environ.copy()
    env['RUST_LOG'] = 'info'
    with (logs / f'{stamp}.log').open('ab') as output:
        proc = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=output, stderr=subprocess.STDOUT, start_new_session=args.background)
    (ROOT / 'run.json').write_text(json.dumps({'pid': proc.pid, 'url': f'http://127.0.0.1:{port}/', 'journal': str(journal)}, ensure_ascii=False, indent=2))
    for _ in range(50):
        if proc.poll() is not None:
            raise SystemExit(f'Сервер завершился ({proc.returncode}). Журнал: {logs / (stamp + ".log")}')
        try:
            s = state(port)
            break
        except (OSError, ValueError, urllib.error.URLError):
            time.sleep(.2)
    else:
        proc.terminate()
        raise SystemExit('Сервер не ответил. Проверь журнал и занятость портов 6666/8765.')
    print(f'PZ65 Studio: http://127.0.0.1:{port}/\nЖурнал: {journal}\nПитание и содержимое карт при запуске не меняются.', flush=True)
    if args.background:
        return
    print('Ctrl+C — остановить сервер.', flush=True)
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        proc.wait(timeout=10)

if __name__ == '__main__':
    main()
