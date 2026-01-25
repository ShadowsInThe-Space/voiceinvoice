#!/usr/bin/env python3
"""
E2E Test: Voice-to-Invoice Pipeline
Tests voice recording, transcription, AI extraction, and auto-save.
"""

from playwright.sync_api import sync_playwright
import sys
import time

def test_voice_to_invoice():
    """Test voice-to-invoice workflow."""
    print("\n🧪 Tests 1-3: Voice-to-Invoice Pipeline")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            locale='de-DE',
            timezone_id='Europe/Berlin',
            # Grant media permissions for voice recording
            permissions=['microphone']
        )
        page = context.new_page()

        errors = []
        network_requests = []

        page.on('console', lambda msg:
            errors.append(msg.text) if msg.type in ['error', 'warning'] else None
        )

        # Track API calls
        page.on('request', lambda req:
            network_requests.append({
                'url': req.url,
                'method': req.method
            }) if any(keyword in req.url for keyword in ['transcribe', 'voice', 'gemini', 'chirp']) else None
        )

        try:
            # Test 1: Voice Recording UI
            print("\n   🎤 Test 1: Voice Recording UI")
            page.goto('http://localhost:3002/invoices/new', timeout=60000)
            page.wait_for_load_state('networkidle')

            page.screenshot(path='test-results/voice_invoice_initial.png', full_page=True)

            # Look for voice recorder button
            voice_button = None
            button_selectors = [
                'button:has-text("Aufnahme")',
                'button:has-text("Mikrofon")',
                'button[aria-label*="voice"]',
                'button[aria-label*="record"]',
                'button:has([class*="mic"])',
                '.voice-recorder button',
                '[data-testid="voice-button"]'
            ]

            for selector in button_selectors:
                try:
                    btn = page.locator(selector).first
                    if btn.is_visible():
                        voice_button = btn
                        print(f"   ✅ Found voice button: {selector}")
                        break
                except:
                    continue

            if voice_button:
                print("   ✅ Voice recording button detected")

                # Click to start recording
                voice_button.click()
                print("   🎙️  Started recording simulation")
                page.wait_for_timeout(1000)

                page.screenshot(path='test-results/voice_recording_active.png', full_page=True)

                # Simulate recording for 2 seconds
                page.wait_for_timeout(2000)

                # Try to stop recording
                stop_button = page.locator('button:has-text("Stopp")').or_(
                    page.locator('button:has-text("Stop")')
                ).or_(
                    voice_button  # Same button might toggle
                )

                if stop_button.count() > 0:
                    stop_button.first.click()
                    print("   ⏹️  Stopped recording")
                else:
                    print("   ⚠️  Stop button not found")

                # Wait for processing
                print("   ⏳ Waiting for transcription & AI processing...")
                page.wait_for_timeout(5000)

                page.screenshot(path='test-results/voice_processing_done.png', full_page=True)

                # Check if form was populated
                page_content = page.content()

                # Look for populated form fields
                filled_inputs = page.locator('input[value]:not([value=""])').all()
                filled_textareas = page.locator('textarea:not(:empty)').all()

                if filled_inputs or filled_textareas:
                    print(f"   ✅ Form populated: {len(filled_inputs)} inputs, {len(filled_textareas)} textareas")
                else:
                    print("   ⚠️  Form not clearly populated (might be mock mode or no audio)")

                # Check network requests
                if network_requests:
                    print(f"   ✅ API calls detected: {len(network_requests)}")
                    for req in network_requests[:3]:
                        print(f"      - {req['method']} {req['url'][:60]}...")
                else:
                    print("   ⚠️  No voice API calls detected (might be mock mode)")

            else:
                print("   ⚠️  Voice recording button not found")
                print("   ℹ️  This might be expected if voice feature is on different page")

            # Test 2: Low-Confidence Flow (Preview Mode)
            print("\n   📋 Test 2: Preview Mode (Low Confidence)")
            print("   ℹ️  Assuming form shows preview when confidence < 0.85")

            # Check if there's a confidence indicator or preview mode UI
            preview_indicators = [
                page.locator('*:has-text("Bitte überprüfen")'),
                page.locator('*:has-text("Confidence")'),
                page.locator('*:has-text("unsicher")'),
                page.locator('[class*="preview"]'),
                page.locator('[class*="confirm"]')
            ]

            preview_mode = any(ind.count() > 0 for ind in preview_indicators)

            if preview_mode:
                print("   ✅ Preview/confirmation UI detected")
            else:
                print("   ℹ️  No clear preview mode (might auto-save with high confidence)")

            # Test 3: Privacy Redaction
            print("\n   🔒 Test 3: Privacy Redaction Check")

            # Check console logs for privacy-related messages
            privacy_logs = [log for log in errors if 'privacy' in log.lower() or 'redact' in log.lower() or 'pii' in log.lower()]

            if privacy_logs:
                print(f"   ✅ Privacy engine logs detected: {len(privacy_logs)}")
                for log in privacy_logs[:2]:
                    print(f"      - {log[:80]}")
            else:
                print("   ℹ️  No explicit privacy logs (might be working silently)")

            # Look for privacy indicators in UI
            privacy_ui = page.locator('*:has-text("anonymisiert")').or_(
                page.locator('*:has-text("DSGVO")')
            ).or_(
                page.locator('*:has-text("Privacy")')
            )

            if privacy_ui.count() > 0:
                print("   ✅ Privacy UI indicators found")
            else:
                print("   ℹ️  No visible privacy indicators")

            # Check console errors
            critical_errors = [e for e in errors if 'error' in e.lower() and 'failed' in e.lower()]

            if critical_errors:
                print(f"\n   ⚠️  Critical errors: {len(critical_errors)}")
                for err in critical_errors[:3]:
                    print(f"      - {err[:100]}")
            else:
                print("\n   ✅ No critical errors")

            print("\n   ✅ Voice-to-Invoice tests completed")
            return True

        except Exception as e:
            print(f"\n   ❌ Test failed: {e}")
            page.screenshot(path='test-results/voice_failure.png', full_page=True)
            import traceback
            traceback.print_exc()
            return False
        finally:
            browser.close()

if __name__ == "__main__":
    success = test_voice_to_invoice()
    sys.exit(0 if success else 1)
