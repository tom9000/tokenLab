# Manual Playwright Commands for Persistent Windows

Instead of running scripts, use these individual commands step-by-step. Each command will keep the browser windows open until you manually close them.

## Step-by-Step Commands

### 1. Launch Browser and Open Token Lab

```javascript
// First, import and launch browser
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

// Navigate to Token Lab
await page.goto('http://localhost:3005');
await page.waitForLoadState('networkidle');

// Take screenshot
await page.screenshot({ path: 'tokenlab-manual.png', fullPage: true });
```

### 2. Open Wallet Popup

```javascript
// Listen for wallet popup
const walletPagePromise = context.waitForEvent('page');

// Click Connect Wallet
await page.click('button:has-text("Connect Wallet")');

// Get the wallet page
const walletPage = await walletPagePromise;
await walletPage.waitForLoadState('networkidle');

// Take screenshot of wallet
await walletPage.screenshot({ path: 'wallet-popup.png', fullPage: true });
```

### 3. Check Wallet State

```javascript
// Check what page we're on
const walletPageType = await walletPage.evaluate(() => 
  document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
);

const walletState = await walletPage.evaluate(() =>
  document.querySelector('meta[name="wallet-state"]')?.getAttribute('content')
);

console.log(`Wallet page: ${walletPageType}, state: ${walletState}`);
```

### 4a. If Create Wallet Page

```javascript
// Fill password fields
await walletPage.fill('#password', 'TestPass123!');
await walletPage.fill('#confirmPassword', 'TestPass123!');

// Click create
await walletPage.click('button:has-text("Create Wallet & New Address")');
await walletPage.waitForLoadState('networkidle');

// Wait for wallet creation
await new Promise(resolve => setTimeout(resolve, 5000));

// Check for seed phrase
const pageContent = await walletPage.textContent('body');
const seedMatch = pageContent?.match(/([a-z]+ ){11}[a-z]+/g);
if (seedMatch) {
  console.log(`Seed phrase: ${seedMatch[0]}`);
}
```

### 4b. If Unlock Wallet Page

```javascript
// Fill password
await walletPage.fill('input[type="password"]', 'TestPass123!');

// Click unlock
await walletPage.click('button:has-text("Unlock")');
await walletPage.waitForLoadState('networkidle');

console.log('Wallet unlocked');
```

### 5. Test Wallet Reset (if on unlock page)

```javascript
// Check for reset button
const resetButton = walletPage.locator('button:has-text("Reset Wallet")');
const hasReset = await resetButton.isVisible();
console.log(`Reset available: ${hasReset}`);

// To actually reset (use with caution):
// await resetButton.click();
```

### 6. Get to Unlock Page (if you created wallet)

```javascript
// Refresh wallet to get unlock page
await walletPage.reload();
await walletPage.waitForLoadState('networkidle');

// Check new state
const newPageType = await walletPage.evaluate(() => 
  document.querySelector('meta[name="wallet-page"]')?.getAttribute('content')
);
console.log(`After refresh: ${newPageType}`);

await walletPage.screenshot({ path: 'wallet-unlock-page.png', fullPage: true });
```

### 7. Test Token Lab Interactions

```javascript
// Back to Token Lab page
// Fill token creation form
const nameInput = page.locator('input').first();
await nameInput.fill('Test Token');

const symbolInput = page.locator('input').nth(1);
await symbolInput.fill('TEST');

// Take screenshot of filled form
await page.screenshot({ path: 'tokenlab-form-filled.png', fullPage: true });

// Check if deploy button is enabled
const deployButton = page.locator('button:has-text("Deploy SEP-41 Token")');
const isEnabled = await deployButton.isEnabled();
console.log(`Deploy button enabled: ${isEnabled}`);
```

## Key Differences from Scripts

1. **No test framework cleanup** - These commands run in isolation
2. **Manual control** - You decide when to close windows
3. **Persistent state** - Browser context remains alive between commands
4. **Interactive debugging** - You can inspect at any point

## To Close Windows

```javascript
// When you're done, close the browser
await browser.close();
```

Or just close the browser windows manually - the commands will still work until you do.

## Benefits of This Approach

- ✅ Windows stay open until manually closed
- ✅ You can inspect DOM at any time
- ✅ Perfect for development and debugging
- ✅ Can run commands in any order
- ✅ Real-time interaction testing
- ✅ No script timeouts or framework interference