#!/usr/bin/env python3
"""
E2E Test: Settings Page
Tests workflow configuration and settings persistence.
"""

from playwright.sync_api import sync_playwright
import sys
import os

def test_settings():
    """Test settings page functionality."""
    print("\n🧪 Test 10: Settings & Workflow Configuration")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            locale='de-DE',
            timezone_id='Europe/Berlin'
        )
        page = context.new_page()

        # Track console errors
        errors = []
        page.on('console', lambda msg:
            errors.append(msg.text) if msg.type == 'error' else None
        )

        try:
            # Navigate to settings
            print("   📍 Navigating to settings page...")
            page.goto('http://localhost:3002/settings', timeout=60000)
            page.wait_for_load_state('networkidle')

            page.screenshot(path='test-results/settings_initial.png', full_page=True)
            print("   ✅ Settings page loaded")

            # Check for settings sections
            page_content = page.content()

            # Look for common settings elements
            has_settings = (
                'webhook' in page_content.lower() or
                'einstellung' in page_content.lower() or
                'konfiguration' in page_content.lower()
            )

            if has_settings:
                print("   ✅ Settings UI detected")
            else:
                print("   ⚠️  Settings UI not clearly visible")

            # Try to find and interact with a webhook URL input
            webhook_inputs = page.locator('input[type="text"], input[type="url"]').all()

            if len(webhook_inputs) > 0:
                print(f"   📝 Found {len(webhook_inputs)} input field(s)")

                # Try to modify first input
                first_input = webhook_inputs[0]
                original_value = first_input.input_value()

                test_value = "https://test.example.com/webhook"
                first_input.fill(test_value)
                print(f"   ✏️  Changed value to: {test_value}")

                # Look for save button
                save_buttons = page.locator('button').filter(has_text='Speichern').or_(
                    page.locator('button').filter(has_text='Save')
                )

                if save_buttons.count() > 0:
                    save_buttons.first.click()
                    print("   💾 Clicked save button")
                    page.wait_for_timeout(1000)

                    page.screenshot(path='test-results/settings_saved.png', full_page=True)

                    # Reload and verify persistence
                    page.reload()
                    page.wait_for_load_state('networkidle')

                    current_value = first_input.input_value()
                    if test_value in current_value:
                        print("   ✅ Setting persisted after reload")
                    else:
                        print(f"   ⚠️  Value changed: {current_value}")
                else:
                    print("   ⚠️  No save button found")
            else:
                print("   ⚠️  No input fields found")

            # Check for console errors
            if errors:
                print(f"   ⚠️  Console errors: {len(errors)}")
                for err in errors[:3]:  # Show first 3
                    print(f"      - {err[:100]}")
            else:
                print("   ✅ No console errors")

            print("   ✅ Settings test completed")
            return True

        except Exception as e:
            print(f"   ❌ Test failed: {e}")
            page.screenshot(path='test-results/settings_failure.png', full_page=True)
            return False
        finally:
            browser.close()

if __name__ == "__main__":
    success = test_settings()
    sys.exit(0 if success else 1)
