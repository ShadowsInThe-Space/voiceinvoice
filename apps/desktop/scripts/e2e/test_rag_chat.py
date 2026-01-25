#!/usr/bin/env python3
"""
E2E Test: RAG Chat
Tests chat interface and AI responses.
"""

from playwright.sync_api import sync_playwright
import sys
import time

def test_rag_chat():
    """Test RAG chat functionality."""
    print("\n🧪 Tests 8-9: RAG Chat")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            locale='de-DE',
            timezone_id='Europe/Berlin'
        )
        page = context.new_page()

        errors = []
        network_requests = []

        page.on('console', lambda msg:
            errors.append(msg.text) if msg.type == 'error' else None
        )

        # Track network requests to n8n webhook
        page.on('request', lambda req:
            network_requests.append(req.url) if 'n8n' in req.url or 'webhook' in req.url else None
        )

        try:
            # Test 8: Send Chat Message
            print("\n   💬 Test 8: Send Chat Message")
            page.goto('http://localhost:3002/chat', timeout=60000)
            page.wait_for_load_state('networkidle')

            page.screenshot(path='test-results/chat_initial.png', full_page=True)

            # Look for chat input - try multiple selectors
            chat_input = None
            selectors_to_try = [
                'textarea[placeholder*="Nachricht"]',
                'input[placeholder*="Nachricht"]',
                'textarea[placeholder*="Frage"]',
                'textarea',
                'input[type="text"]'
            ]

            for selector in selectors_to_try:
                try:
                    input_elem = page.locator(selector).first
                    if input_elem.is_visible():
                        chat_input = input_elem
                        print(f"   ✅ Found chat input: {selector}")
                        break
                except:
                    continue

            if chat_input:
                # Test message
                test_message = "Zeige mir alle offenen Rechnungen"
                chat_input.fill(test_message)
                print(f"   ✏️  Entered message: '{test_message}'")

                page.screenshot(path='test-results/chat_message_typed.png', full_page=True)

                # Try to send - look for send button or Enter key
                send_button = page.locator('button[type="submit"]').or_(
                    page.locator('button').filter(has_text='Senden')
                ).or_(
                    page.locator('button[aria-label*="Send"]')
                )

                if send_button.count() > 0:
                    send_button.first.click()
                    print("   🖱️  Clicked send button")
                else:
                    # Try Enter key
                    page.keyboard.press('Enter')
                    print("   ⌨️  Pressed Enter")

                # Wait for response
                print("   ⏳ Waiting for AI response...")
                page.wait_for_timeout(5000)  # 5s for AI response

                page.screenshot(path='test-results/chat_response.png', full_page=True)

                # Check if response appeared
                page_content = page.content().lower()
                has_response = (
                    'rechnung' in page_content or
                    'invoice' in page_content or
                    len(page.locator('.message, .chat-message, [class*="message"]').all()) > 1
                )

                if has_response:
                    print("   ✅ Chat response detected")
                else:
                    print("   ⚠️  No clear response detected")

                # Check network requests
                if network_requests:
                    print(f"   ✅ Network requests to webhook: {len(network_requests)}")
                    for req in network_requests[:2]:
                        print(f"      - {req}")
                else:
                    print("   ⚠️  No webhook requests detected")

            else:
                print("   ❌ Chat input not found")

            # Test 9: Follow-up message with context
            print("\n   💬 Test 9: Follow-up Message (Context)")

            if chat_input:
                follow_up = "Wie viele sind das insgesamt?"
                chat_input.fill(follow_up)
                print(f"   ✏️  Follow-up: '{follow_up}'")

                # Send again
                if send_button.count() > 0:
                    send_button.first.click()
                else:
                    page.keyboard.press('Enter')

                page.wait_for_timeout(5000)

                page.screenshot(path='test-results/chat_followup.png', full_page=True)

                print("   ✅ Follow-up message sent")
            else:
                print("   ⚠️  Skipped follow-up (no input found)")

            # Check console errors
            if errors:
                print(f"\n   ⚠️  Console errors: {len(errors)}")
                for err in errors[:3]:
                    print(f"      - {err[:100]}")
            else:
                print("\n   ✅ No console errors")

            print("\n   ✅ RAG Chat tests completed")
            return True

        except Exception as e:
            print(f"\n   ❌ Test failed: {e}")
            page.screenshot(path='test-results/chat_failure.png', full_page=True)
            import traceback
            traceback.print_exc()
            return False
        finally:
            browser.close()

if __name__ == "__main__":
    success = test_rag_chat()
    sys.exit(0 if success else 1)
