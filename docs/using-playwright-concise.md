# Playwright Testing for Token Lab

Token Lab is a SEP-41 Token smart contract deployment and management dApp. This document provides quick reference for Playwright testing specific to Token Lab functionality.

## Setup

Token Lab runs on `http://localhost:3005` and uses a separate Chromium instance for testing.

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
npx playwright test --project=tokenlab-chromium
```

## Configuration

The project uses `playwright.config.ts` with:
- Base URL: `http://localhost:3005`
- Separate Chromium browser instance
- Headless mode configurable (set `headless: false` to see browser window)
- Auto-starts dev server on port 3005

## Basic Commands

```javascript
// Navigate to Token Lab
await page.goto('/');

// Screenshot
await page.screenshot({ path: 'tokenlab-screenshot.png', fullPage: true });

// Fill form fields
await page.fill('input[placeholder="My Token"]', 'TEST-TOKEN');
await page.fill('input[placeholder="MTK"]', 'TST');

// Click buttons
await page.click('button:has-text("Connect Wallet")');
await page.click('button:has-text("Deploy SEP-41 Token")');

// Get visible text
await page.textContent('body');

// Check console logs
const logs = await page.evaluate(() => console.log('test'));
```

## Token Lab Specific Elements

### Page State Detection

Token Lab includes meta tags for reliable page state detection:

```javascript
// Check current page and state
const pageType = await page.evaluate(() => 
  document.querySelector('meta[name="tokenlab-page"]')?.getAttribute('content')
);
const pageState = await page.evaluate(() =>
  document.querySelector('meta[name="tokenlab-state"]')?.getAttribute('content')
);

// Returns: pageType = "main", pageState = "ready"
```

### Main UI Sections

**Create SEP-41 Token Section:**
- Name field: `input` (first text input)
- Symbol field: `input` (second text input) 
- Decimals: `input[type="number"]`
- Initial Supply: `input` (fourth text input)
- Max Supply: `input[placeholder="Unlimited supply"]`
- Toggle switches: Fixed Supply, Mintable, Burnable, Freezable
- Deploy button: `button:has-text("Deploy SEP-41 Token")`

**Manage Token Section:**
- Contract Address: `input[placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"]`
- Mint Amount: `input[placeholder="1000"]`
- Burn Amount: `input[placeholder="500"]`
- Freeze/Unfreeze Address: `input[placeholder="GXXXXX..."]`
- Action buttons: `button:has-text("Mint")`, `button:has-text("Burn")`, etc.

**Navigation Elements:**
- Connect Wallet: `button:has-text("Connect Wallet")`
- Development links: `a[href="http://localhost:3003"]`, `a[href="http://localhost:3005"]`

### Common Selectors

```javascript
// Wallet connection
'button:has-text("Connect Wallet")'

// Token creation form
'input[placeholder="My Token"]'        // Name field
'input[placeholder="MTK"]'             // Symbol field  
'input[type="number"]'                 // Decimals field
'button:has-text("Deploy SEP-41 Token")'

// Token management
'input[placeholder="CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"]' // Contract address
'button:has-text("Mint")'              // Mint button
'button:has-text("Burn")'              // Burn button
'button:has-text("Freeze")'            // Freeze button
'button:has-text("Transfer")'          // Transfer button

// Page sections
'h3:has-text("Create SEP-41 Token")'
'h3:has-text("Manage Token")'
'h3:has-text("Transaction Log")'
'h3:has-text("Testing Workflow")'

// Development links
'a[href="http://localhost:3003"]'      // Safu-Dev Wallet
'a[href="http://localhost:3005"]'      // Token Lab (self)
```

## Testing Workflows

### Basic Page Load Test
```javascript
test('Token Lab loads correctly', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Verify page loaded
  await expect(page).toHaveTitle(/Token Lab.*SEP-41/);
  
  // Check meta tags
  const pageType = await page.evaluate(() => 
    document.querySelector('meta[name="tokenlab-page"]')?.getAttribute('content')
  );
  expect(pageType).toBe('main');
});
```

### Form Interaction Test
```javascript
test('Can interact with token creation form', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Fill out token creation form
  const nameInput = page.locator('input').first();
  await nameInput.fill('Test Token');
  
  const symbolInput = page.locator('input').nth(1);
  await symbolInput.fill('TEST');
  
  // Toggle switches
  await page.click('text=Mintable'); // Toggle mintable option
  
  // Verify form filled
  expect(await nameInput.inputValue()).toBe('Test Token');
  expect(await symbolInput.inputValue()).toBe('TEST');
});
```

### Button State Testing
```javascript
test('Button states work correctly', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Connect wallet button should be enabled
  await expect(page.locator('button:has-text("Connect Wallet")')).toBeEnabled();
  
  // Deploy button should be enabled (even without wallet for UI testing)
  await expect(page.locator('button:has-text("Deploy SEP-41 Token")')).toBeEnabled();
  
  // Management buttons should be disabled initially
  await expect(page.locator('button:has-text("Mint")')).toBeDisabled();
  await expect(page.locator('button:has-text("Burn")')).toBeDisabled();
});
```

## Page Structure

Token Lab has a single main page with the following sections:

1. **Header**: SEP-41 Token Deployer title and Connect Wallet button
2. **Create SEP-41 Token**: Form for deploying new tokens
3. **Manage Token**: Interface for managing existing tokens  
4. **Transaction Log**: Console output and status messages
5. **Testing Workflow**: Development information and current functionality
6. **Development Links**: Links to related development tools

## Meta Tags for Automation

```html
<meta name="tokenlab-page" content="main" />
<meta name="tokenlab-state" content="ready" />
<meta name="description" content="Token Lab - SEP-41 Token smart contract deployment and management dApp" />
```

Use these for reliable page state detection:
```javascript
// Quick page identification
const isTokenLabMain = await page.evaluate(() => 
  document.querySelector('meta[name="tokenlab-page"]')?.getAttribute('content') === 'main'
);
```

## Screenshot Testing

```javascript
// Full page screenshot
await page.screenshot({ 
  path: 'tokenlab-full-page.png',
  fullPage: true 
});

// Specific section screenshot
await page.locator('h3:has-text("Create SEP-41 Token")').screenshot({
  path: 'create-token-section.png'
});
```

## Console Log Monitoring

Token Lab outputs detailed logs to the Transaction Log section. Monitor these for debugging:

```javascript
// Listen for console messages
page.on('console', msg => {
  console.log('Token Lab:', msg.text());
});

// Check for specific log patterns
const logs = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.transaction-log .log-entry'))
    .map(el => el.textContent);
});
```

## Wallet Connection Testing

### Safu-Dev Wallet Integration

Token Lab connects to the Safu-Dev wallet running on `http://localhost:3003`. The wallet connection process involves popup windows and different page states.

#### Wallet Page States

The Safu-Dev wallet uses meta tags for page state detection:

```javascript
// Check wallet page state
const walletPageType = await walletPage.evaluate(() => 
  document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
);
const walletState = await walletPage.evaluate(() =>
  document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
);
```

**Possible states:**
- `wallet-page="create"` + `wallet-state="no-wallet"` → Create Wallet Screen
- `wallet-page="unlock"` + `wallet-state="locked"` → Unlock Screen
- `wallet-page="unlock"` + `wallet-state="no-wallet"` → Unlock Screen (wallet exists but logged out)
- `wallet-page="wallet"` + `wallet-state="unlocked"` → Main Wallet Screen

#### Wallet Connection Test Pattern

```javascript
test('should connect to Safu-Dev wallet', async ({ page }) => {
  await page.goto('/');
  
  // Listen for popup window
  const pagePromise = page.context().waitForEvent('page');
  await page.click('button:has-text("Connect Wallet")');
  
  const walletPage = await pagePromise;
  await walletPage.waitForLoadState('networkidle');
  
  // Check what page we're on
  const walletPageType = await walletPage.evaluate(() => 
    document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
  );
  
  if (walletPageType === 'create') {
    // Create new wallet
    await walletPage.fill('#password', 'TestPass123!');
    await walletPage.fill('#confirmPassword', 'TestPass123!');
    await walletPage.click('button:has-text("Create Wallet & New Address")');
  } else if (walletPageType === 'unlock') {
    // Unlock existing wallet
    await walletPage.fill('input[type="password"]', 'TestPass123!');
    await walletPage.click('button:has-text("Unlock")');
  }
});
```

### Wallet Page Structures

#### Create Wallet Page

**Elements:**
- Password field: `#password` (placeholder: "Enter secure password (12+ characters)")
- Confirm password: `#confirmPassword` (placeholder: "Confirm password")
- Seed phrase toggle: 12/24 words selector
- Create button: `button:has-text("Create Wallet & New Address")`
- Alternative: `button:has-text("Create from Seed")`
- Freighter integration: `button:has-text("Install Freighter Extension")`

**Test credentials:**
- Password: `TestPass123!` (must have uppercase, lowercase, number, special character)

#### Unlock Wallet Page

**Elements:**
- Password field: `input[type="password"]` (placeholder: "Enter your password")
- Unlock button: `button:has-text("Unlock")`
- Reset option: `button:has-text("Reset Wallet")` or `:text("Reset Wallet")`

**Example seed phrase from test wallet:**
```
legal winner thank year wave sausage worth useful legal winner thank yellow
```

**⚠️ KNOWN BUG:** The Safu-Dev wallet currently generates the same seed phrase repeatedly instead of creating unique random phrases. This is a security issue that should be reported to the wallet project. Each wallet creation should generate a cryptographically secure, unique seed phrase.

#### Wallet State Persistence

**Important:** Each Playwright browser session creates an isolated storage context:
- Fresh browser sessions always show "Create Wallet" page initially
- After creating a wallet and refreshing, you get the "Unlock" page
- Wallet data persists within the same browser session
- Different test runs create separate wallet instances

#### Getting to Unlock Page

```javascript
// Method 1: Create wallet first, then refresh
test('should reach unlock page', async ({ page }) => {
  await page.goto('http://localhost:3003');
  
  // Create wallet first
  await page.fill('#password', 'TestPass123!');
  await page.fill('#confirmPassword', 'TestPass123!');
  await page.click('button:has-text("Create Wallet & New Address")');
  
  // Wait for creation, then refresh
  await page.waitForTimeout(5000);
  await page.reload();
  
  // Now should be on unlock page
  const pageType = await page.evaluate(() => 
    document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
  );
  // pageType should now be "unlock"
});
```

### Wallet Reset Functionality

The unlock page includes a "Reset Wallet" option:

```javascript
// Check for reset option
const resetButton = walletPage.locator('button:has-text("Reset Wallet"), :text("Reset Wallet")');
const hasReset = await resetButton.first().isVisible();

if (hasReset) {
  // Reset wallet (use with caution)
  await resetButton.first().click();
  
  // Usually requires confirmation
  const confirmReset = walletPage.locator('button:has-text("Yes, Reset"), button:has-text("Confirm")');
  if (await confirmReset.first().isVisible()) {
    await confirmReset.first().click();
  }
}
```

## Testing Notes

- Token Lab is designed for testing token deployment workflows
- The interface includes mock wallet functionality for development
- Most buttons remain enabled for UI testing even without wallet connection
- Transaction Log provides real-time feedback on operations
- Development Links section provides quick access to related tools
- **Wallet Integration:** Each browser session creates isolated wallet storage
- **Test Password:** Always use `TestPass123!` for consistency

## Browser Configuration

- Uses separate Chromium instance to avoid conflicts with other projects
- Configured for `localhost:3005` (Token Lab's dedicated port)
- Supports both headless and visible browser modes
- Automatic dev server startup and shutdown
- Popup window handling for wallet connections
- Isolated storage contexts per test session

## Keeping Browser Windows Open

By default, Playwright test framework closes browser windows when tests complete. Here are the best methods to keep windows open:

### Method 1: Individual Commands (ONLY RELIABLE METHOD)

Use individual Playwright commands through Claude Code execution. This is the **only method that reliably keeps windows open**:

```javascript
// Launch browser manually through Claude Code execution
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

// Commands run individually - windows stay open
await page.goto('http://localhost:3005');
```

See `manual-playwright-commands.md` for complete step-by-step commands.

**Why this works:**
- ✅ No script lifecycle to close browsers
- ✅ Each command runs independently
- ✅ Windows persist between commands
- ✅ Perfect for development and debugging
- ✅ Can inspect DOM at any time

**Important:** Scripts (even with infinite loops) will eventually close browser windows due to process management. Only individual commands through Claude Code execution keep windows truly persistent.

### Method 1b: Open from Claude Code, Target with Scripts (HYBRID APPROACH)

This combines the best of both approaches:

1. **Open browser from Claude Code** (stays persistent):
```javascript
import { chromium } from 'playwright';
const browser = await chromium.launch({ 
  headless: false,
  args: ['--remote-debugging-port=9222']  // Enable remote debugging
});
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('http://localhost:3005');
```

2. **Target the existing browser with scripts**:
```bash
npm run test:existing
```

This script connects to the existing browser and runs tests without creating new windows.

**Benefits:**
- ✅ Windows stay open (opened from Claude Code)
- ✅ Can run automated test scripts against persistent windows
- ✅ Best of both worlds: persistence + automation

### Method 2: Using the Keep-Windows-Open Script

```bash
node keep-windows-open.js
```

This script:
- Opens both Token Lab and Safu-Dev wallet
- Handles the wallet connection process
- Keeps both windows open indefinitely
- Press Ctrl+C to close when done

### Method 2: Infinite Wait in Tests

```javascript
test('should keep windows open', async ({ page, context }) => {
  // ... your test logic ...
  
  console.log('Windows will stay open - press Ctrl+C to close');
  
  // Infinite wait to prevent window closure
  await new Promise(() => {}); // Never resolves
});
```

### Method 3: Debug Mode

```bash
npx playwright test --debug
```

This opens the Playwright Inspector and keeps browsers open until you close the inspector.

### Method 4: Manual Browser Launch

For development purposes, you can launch browsers manually:

```javascript
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ 
  headless: false,
  devtools: true // Opens DevTools
});

// Your testing logic here

// Don't call browser.close() to keep windows open
```

## Playwright MCP Server Setup and Direct Commands

### Installation

The Playwright MCP server must be installed for Claude Code to access direct Playwright commands:

```bash
# Install Playwright MCP server for Claude Code
claude mcp add playwright npx @playwright/mcp@latest

# Verify installation
claude mcp list
# Should show: playwright: npx @playwright/mcp@latest
```

**Important:** After installing the MCP server, you must restart Claude Code for the tools to become available.

### Direct Playwright MCP Commands

Once the MCP server is installed and Claude Code is restarted, you can use direct Playwright commands:

#### Basic Navigation
```javascript
// Navigate to Token Lab (browser window stays open)
playwright_navigate({url: "http://localhost:3005", headless: false})

// Navigate to Safu-Dev Wallet
playwright_navigate({url: "http://localhost:3003", headless: false})
```

#### Taking Screenshots
```javascript
// Basic screenshot
playwright_screenshot({name: "tokenlab_main", storeBase64: true})

// Full page screenshot
playwright_screenshot({name: "tokenlab_full", fullPage: true, storeBase64: true})
```

#### Form Interactions
```javascript
// Fill Token Lab form fields
playwright_fill({selector: "input", value: "Test Token"})  // First input (name)
playwright_fill({selector: "input:nth-child(2)", value: "TEST"})  // Symbol

// Connect wallet
playwright_click({selector: "button:has-text(\"Connect Wallet\")"})

// Deploy token
playwright_click({selector: "button:has-text(\"Deploy SEP-41 Token\")"})
```

#### Wallet Operations
```javascript
// Create wallet (if on create page)
playwright_fill({selector: "#password", value: "TestPass123!"})
playwright_fill({selector: "#confirmPassword", value: "TestPass123!"})
playwright_click({selector: "button:has-text(\"Create Wallet & New Address\")"})

// Unlock wallet (if on unlock page)
playwright_fill({selector: "input[type=\"password\"]", value: "TestPass123!"})
playwright_click({selector: "button:has-text(\"Unlock\")"})
```

#### Advanced Operations
```javascript
// Execute custom JavaScript
playwright_evaluate({script: "document.title"})
playwright_evaluate({script: "window.location.href"})

// Get page content
playwright_get_visible_text()

// Monitor console logs
playwright_console_logs({limit: 10, search: "wallet"})
```

### Hybrid Approach: MCP + Scripts

**Step 1:** Use MCP commands to open persistent browser:
```javascript
// Open Token Lab with MCP (stays persistent)
playwright_navigate({url: "http://localhost:3005", headless: false})

// Open wallet popup
playwright_click({selector: "button:has-text(\"Connect Wallet\")"})
```

**Step 2:** Run targeting script:
```bash
# This script connects to the existing browser opened with MCP
npm run test:existing
```

### Benefits of MCP Direct Commands

- ✅ **Truly Persistent**: Windows stay open until manually closed
- ✅ **No Script Lifecycle**: Not managed by test framework
- ✅ **Real-time Interaction**: Can inspect and modify pages live
- ✅ **Best for Development**: Perfect for testing and debugging
- ✅ **Scriptable**: Can combine with automation scripts that target existing browser

### Troubleshooting MCP Setup

1. **Tools not available**: Restart Claude Code after installing MCP server
2. **Installation fails**: Check if `npx` and `@playwright/mcp` are accessible
3. **Commands don't work**: Verify MCP server is running: `claude mcp list`
4. **Browser doesn't open**: Ensure Token Lab dev server is running on port 3005

### MCP vs Traditional Testing

| Approach | Window Persistence | Automation | Use Case |
|----------|-------------------|------------|----------|
| MCP Direct Commands | ✅ Persistent | Manual/Interactive | Development, debugging |
| Traditional Scripts | ❌ Auto-close | ✅ Automated | CI/CD, regression testing |
| Hybrid (MCP + Scripts) | ✅ Persistent | ✅ Automated | Best of both worlds |

**Recommendation:** Use MCP direct commands for development and testing, then create scripts for automation that can target the persistent browser sessions.