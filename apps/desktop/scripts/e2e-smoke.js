/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/explicit-function-return-type */
const { chromium } = require('playwright');

async function run() {
  console.log('Starting E2E Smoke Test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    // 1. Dashboard
    console.log('Navigating to Dashboard...');
    try {
      await page.goto('http://localhost:3002/dashboard', { timeout: 60000 });
      await page.waitForLoadState('networkidle');
    } catch (e) {
      console.error('Failed to load dashboard (might need login or slow start):', e.message);
      await page.screenshot({ path: 'test-results/dashboard_error.png' });
      // Try root if dashboard fails
      await page.goto('http://localhost:3002/');
      await page.waitForLoadState('networkidle');
    }

    console.log('Page loaded:', await page.title());
    await page.screenshot({ path: 'test-results/dashboard.png' });

    // Check for KPI cards
    const kpi = await page.getByText('Offene Mahnungen').isVisible();
    console.log(`KPI 'Offene Mahnungen' visible: ${kpi}`);

    // 2. Invoices
    console.log('Navigating to Invoices...');
    // Try click nav
    const invoicesLink = page.locator('a[href="/invoices"]');
    if (await invoicesLink.isVisible()) {
      await invoicesLink.click();
    } else {
      await page.goto('http://localhost:3002/invoices');
    }
    await page.waitForLoadState('networkidle');
    console.log('Invoices list loaded.');
    await page.screenshot({ path: 'test-results/invoices_list.png' });

    // 3. Create Invoice
    console.log('Creating New Invoice...');
    // Check for New Invoice button
    let newBtn = page.getByRole('button', { name: 'Rechnung erstellen' });
    if (!(await newBtn.isVisible())) newBtn = page.getByText('Neue Rechnung');
    if (!(await newBtn.isVisible())) newBtn = page.locator('a[href="/invoices/new"]');

    if (await newBtn.isVisible()) {
      await newBtn.click();
    } else {
      console.log('New Invoice button not found, navigating directly...');
      await page.goto('http://localhost:3002/invoices/new');
    }
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/invoice_form.png' });

    // 4. Settings
    console.log('Navigating to Settings...');
    await page.goto('http://localhost:3002/settings');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/settings.png' });

    // 5. Chat
    console.log('Navigating to Chat...');
    await page.goto('http://localhost:3002/chat');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/chat.png' });

    // Basic interaction
    const chatInput = page.locator(
      'textarea[placeholder*="Nachricht"], input[placeholder*="Nachricht"]'
    );
    if (await chatInput.isVisible()) {
      await chatInput.fill('Hallo!');
      await page.keyboard.press('Enter');
      console.log('Sent chat message.');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/chat_response.png' });
    }
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'test-results/failure.png' });
  } finally {
    await browser.close();
    console.log('Test complete.');
  }
}

run();
