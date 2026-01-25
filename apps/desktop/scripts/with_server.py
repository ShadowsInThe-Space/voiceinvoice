#!/usr/bin/env python3
"""
Server lifecycle manager for E2E tests.
Starts development server, waits for readiness, runs test script, then cleanup.

Usage:
    python scripts/with_server.py --server "pnpm dev:electron" --port 3002 -- python test.py
    python scripts/with_server.py --help
"""

import argparse
import subprocess
import time
import sys
import socket
import signal
import os
from typing import List, Optional

def is_port_open(port: int, host: str = "localhost", timeout: float = 1.0) -> bool:
    """Check if a port is open and accepting connections."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False

def wait_for_server(port: int, timeout: int = 120, check_interval: float = 2.0) -> bool:
    """Wait for server to be ready on specified port."""
    print(f"⏳ Waiting for server on port {port}...")
    start_time = time.time()

    while time.time() - start_time < timeout:
        if is_port_open(port):
            print(f"✅ Server ready on port {port}")
            return True
        time.sleep(check_interval)

    print(f"❌ Server did not start within {timeout}s", file=sys.stderr)
    return False

def main():
    parser = argparse.ArgumentParser(
        description="Manage server lifecycle for E2E tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single server
  python scripts/with_server.py --server "pnpm dev:electron" --port 3002 -- python test.py

  # Multiple servers (backend + frontend)
  python scripts/with_server.py \\
    --server "cd backend && python server.py" --port 3000 \\
    --server "pnpm dev" --port 5173 \\
    -- python test.py
        """
    )

    parser.add_argument(
        '--server',
        action='append',
        required=True,
        help='Server command to run (can be specified multiple times)'
    )
    parser.add_argument(
        '--port',
        type=int,
        action='append',
        required=True,
        help='Port to wait for (one per --server, in same order)'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=120,
        help='Seconds to wait for server readiness (default: 120)'
    )
    parser.add_argument(
        'test_command',
        nargs=argparse.REMAINDER,
        help='Test command to run after servers are ready'
    )

    args = parser.parse_args()

    # Validate arguments
    if len(args.server) != len(args.port):
        parser.error("Number of --server and --port arguments must match")

    # Remove '--' separator if present
    if args.test_command and args.test_command[0] == '--':
        args.test_command = args.test_command[1:]

    if not args.test_command:
        parser.error("No test command provided after '--'")

    server_processes: List[subprocess.Popen] = []

    def cleanup():
        """Kill all server processes."""
        for proc in server_processes:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        print("🧹 Servers stopped")

    def signal_handler(sig, frame):
        print("\n⚠️  Interrupted, cleaning up...")
        cleanup()
        sys.exit(1)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        # Start all servers
        for cmd, port in zip(args.server, args.port):
            print(f"🚀 Starting server: {cmd}")
            proc = subprocess.Popen(
                cmd,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid if hasattr(os, 'setsid') else None
            )
            server_processes.append(proc)

            # Give each server a moment to start
            time.sleep(2)

        # Wait for all servers to be ready
        all_ready = True
        for port in args.port:
            if not wait_for_server(port, timeout=args.timeout):
                all_ready = False
                break

        if not all_ready:
            print("❌ Not all servers started successfully", file=sys.stderr)
            cleanup()
            return 1

        # Run test command
        print(f"▶️  Running test: {' '.join(args.test_command)}")
        result = subprocess.run(args.test_command)

        cleanup()
        return result.returncode

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        cleanup()
        return 1

if __name__ == "__main__":
    sys.exit(main())
