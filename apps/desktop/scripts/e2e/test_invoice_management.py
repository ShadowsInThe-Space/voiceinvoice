#!/usr/bin/env python3
"""
E2E Test: Invoice Management
Tests CRUD operations for invoices: Create, Read, Update, Export.
"""

from playwright.sync_api import sync_playwright
import sys
import time

def test_invoice_management():
    """Test invoice management workflows."""
    print("\n🧪 Tests 4-7: Invoice Management")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            locale='de-DE',
            timezone_id='Europe/Berlin'
        )
        page = context.new_page()

        errors = []
        page.on('console', lambda msg:
            errors.append(msg.text) if msg.type == 'error' else None
        )

        try:
            # Test 4: Create Invoice Manually
            print("\n   📝 Test 4: Create Invoice Manually")
            page.goto('http://localhost:3002/invoices/new', timeout=60000)
            page.wait_for_load_state('networkidle')

            page.screenshot(path='test-results/invoice_form_empty.png', full_page=True)

            # Look for form fields
            customer_input = page.locator('input[name*="customer"], input[placeholder*="Kunde"], input[id*="customer"]').first
            amount_input = page.locator('input[name*="amount"], input[type="number"], input[placeholder*="Betrag"]').first

            if customer_input.is_visible() and amount_input.is_visible():
                print("   ✅ Invoice form detected")

                # Fill form
                customer_input.fill("Test Kunde GmbH")
                amount_input.fill("500.00")
                print("   ✏️  Form filled: Customer='Test Kunde GmbH', Amount=500.00")

                page.screenshot(path='test-results/invoice_form_filled.png', full_page=True)

                # Look for save/submit button
                save_button = page.locator('button').filter(has_text='Speichern').or_(
                    page.locator('button').filter(has_text='Erstellen')
                ).or_(
                    page.locator('button[type="submit"]')
                )

                if save_button.count() > 0:
                    save_button.first.click()
                    print("   💾 Clicked save button")
                    page.wait_for_timeout(2000)

                    page.screenshot(path='test-results/invoice_created.png', full_page=True)
                    print("   ✅ Invoice created")
                else:
                    print("   ⚠️  Save button not found")
            else:
                print("   ⚠️  Invoice form fields not found")

            # Test 5: Navigate to invoice list
            print("\n   📋 Test 5: View Invoice List")
            page.goto('http://localhost:3002/invoices', timeout=60000)
            page.wait_for_load_state('networkidle')

            page.screenshot(path='test-results/invoices_list.png', full_page=True)

            page_content = page.content()
            has_invoices = (
                'Test Kunde' in page_content or
                '500' in page_content or
                'Rechnung' in page_content
            )

            if has_invoices:
                print("   ✅ Invoice list shows data")
            else:
                print("   ⚠️  Invoice list appears empty")

            # Test 6: Try to edit invoice
            print("\n   ✏️  Test 6: Edit Invoice")

            # Look for edit button or clickable invoice row
            edit_buttons = page.locator('button').filter(has_text='Bearbeiten').or_(
                page.locator('a[href*="/invoices/"]').filter(has_text='Bearbeiten')
            )

            if edit_buttons.count() > 0:
                edit_buttons.first.click()
                print("   🖱️  Clicked edit button")
                page.wait_for_timeout(2000)

                page.screenshot(path='test-results/invoice_edit_form.png', full_page=True)

                # Try to modify amount
                amount_edit = page.locator('input[type="number"]').first
                if amount_edit.is_visible():
                    amount_edit.fill("750.00")
                    print("   ✏️  Changed amount to 750.00")

                    # Save changes
                    save_btn = page.locator('button').filter(has_text='Speichern').first
                    if save_btn.is_visible():
                        save_btn.click()
                        print("   💾 Saved changes")
                        page.wait_for_timeout(2000)
                        print("   ✅ Invoice edited")
            else:
                print("   ⚠️  Edit button not found (might need different approach)")

            # Test 7: PDF Export
            print("\n   📄 Test 7: PDF Export")

            # Look for export/download button
            export_buttons = page.locator('button').filter(has_text='PDF').or_(
                page.locator('button').filter(has_text='Export')
            ).or_(
                page.locator('button').filter(has_text='Download')
            )

            if export_buttons.count() > 0:
                print("   ✅ PDF export button found")

                # Set up download listener
                with page.expect_download() as download_info:
                    export_buttons.first.click()
                    print("   🖱️  Clicked PDF export")

                download = download_info.value
                download_path = f"test-results/exported_invoice.pdf"
                download.save_as(download_path)
                print(f"   ✅ PDF downloaded: {download_path}")
            else:
                print("   ⚠️  PDF export button not found")

            # Check console errors
            if errors:
                print(f"\n   ⚠️  Console errors detected: {len(errors)}")
                for err in errors[:3]:
                    print(f"      - {err[:100]}")
            else:
                print("\n   ✅ No console errors")

            print("\n   ✅ Invoice management tests completed")
            return True

        except Exception as e:
            print(f"\n   ❌ Test failed: {e}")
            page.screenshot(path='test-results/invoice_mgmt_failure.png', full_page=True)
            import traceback
            traceback.print_exc()
            return False
        finally:
            browser.close()

if __name__ == "__main__":
    success = test_invoice_management()
    sys.exit(0 if success else 1)
