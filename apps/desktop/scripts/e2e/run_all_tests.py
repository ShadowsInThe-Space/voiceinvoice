#!/usr/bin/env python3
"""
Master E2E Test Runner
Executes all E2E tests sequentially and reports results.
"""

import subprocess
import sys
import time
from pathlib import Path

# Test suite configuration
TESTS = [
    {
        'name': 'Settings & Configuration',
        'script': 'test_settings.py',
        'description': 'Workflow configuration and persistence'
    },
    {
        'name': 'Invoice Management',
        'script': 'test_invoice_management.py',
        'description': 'Create, edit, export invoices'
    },
    {
        'name': 'RAG Chat',
        'script': 'test_rag_chat.py',
        'description': 'Chat interface and AI responses'
    },
    {
        'name': 'Voice-to-Invoice',
        'script': 'test_voice_to_invoice.py',
        'description': 'Voice recording and AI processing'
    }
]

def run_test(test_info):
    """Run a single test and return success status."""
    print(f"\n{'='*70}")
    print(f"🧪 Running: {test_info['name']}")
    print(f"   {test_info['description']}")
    print(f"{'='*70}")

    script_path = Path(__file__).parent / test_info['script']

    start_time = time.time()

    try:
        result = subprocess.run(
            ['python3', str(script_path)],
            capture_output=False,
            text=True
        )

        elapsed = time.time() - start_time

        if result.returncode == 0:
            print(f"\n✅ PASSED in {elapsed:.1f}s: {test_info['name']}")
            return True
        else:
            print(f"\n❌ FAILED in {elapsed:.1f}s: {test_info['name']}")
            return False

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\n❌ ERROR in {elapsed:.1f}s: {test_info['name']}")
        print(f"   {e}")
        return False

def main():
    """Run all E2E tests and report summary."""
    print("\n" + "="*70)
    print("🚀 VoiceInvoice Enterprise E2E Test Suite")
    print("="*70)

    print("\n📋 Test Plan:")
    for i, test in enumerate(TESTS, 1):
        print(f"   {i}. {test['name']} - {test['description']}")

    print("\n⚠️  Prerequisites:")
    print("   - Development server running on http://localhost:3002")
    print("   - Database initialized")
    print("   - API keys configured in .env")

    print("\n▶️  Starting tests...\n")

    results = []
    start_time = time.time()

    for test in TESTS:
        success = run_test(test)
        results.append({
            'name': test['name'],
            'success': success
        })

        # Brief pause between tests
        if test != TESTS[-1]:
            time.sleep(2)

    total_time = time.time() - start_time

    # Summary
    print("\n" + "="*70)
    print("📊 Test Summary")
    print("="*70)

    passed = sum(1 for r in results if r['success'])
    failed = len(results) - passed

    for i, result in enumerate(results, 1):
        status = "✅ PASS" if result['success'] else "❌ FAIL"
        print(f"   {i}. {status} - {result['name']}")

    print(f"\n📈 Results: {passed}/{len(results)} tests passed")
    print(f"⏱️  Total time: {total_time:.1f}s")

    if failed > 0:
        print(f"\n❌ {failed} test(s) failed")
        print("   Check screenshots in test-results/ directory")
        return 1
    else:
        print("\n✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
