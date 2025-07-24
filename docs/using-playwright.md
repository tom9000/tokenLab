# Using Playwright MCP for SAFU Dev Wallet Testing

This document provides instructions for agents on how to use the Playwright Model Context Protocol (MCP) server to interact with and test the SAFU Dev Wallet.

## Setup and Configuration

The Playwright MCP server is installed globally and configured in Claude Code settings:
- Package: `@executeautomation/playwright-mcp-server`
- Settings: `/Users/mac/.config/claude-code/settings.json`
- Logs: `~/Users/mac/Library/Logs/Claude/mcp-server-playwright.log`

## Basic Navigation

### Starting a Browser Session

```javascript
// Navigate to the wallet (adjust port as needed)
mcp__playwright__playwright_navigate({
  url: "http://localhost:3003",
  headless: false  // Set to true for headless mode
})
```

### Taking Screenshots

```javascript
// Basic screenshot
mcp__playwright__playwright_screenshot({
  name: "screenshot_name",
  storeBase64: true
})

// Full page screenshot (captures content below viewport)
mcp__playwright__playwright_screenshot({
  name: "full_page_screenshot", 
  fullPage: true,
  storeBase64: true
})
```

## Wallet Operations

### Creating a New Wallet

**Password Requirements:**
- Must contain uppercase letters
- Must contain lowercase letters  
- Must contain numbers
- Must contain special characters
- Example: `TestPass123!`

**Process:**
1. Navigate to wallet URL
2. Fill password fields using specific IDs
3. Click create button
4. Monitor console logs for success

```javascript
// Fill password fields (use IDs for reliability)
mcp__playwright__playwright_fill({
  selector: "#password",
  value: "TestPass123!"
})

mcp__playwright__playwright_fill({
  selector: "#confirmPassword", 
  value: "TestPass123!"
})

// Click create button
mcp__playwright__playwright_click({
  selector: "button:has-text(\"Create Wallet & New Address\")"
})
```

**Success Indicators:**
- Console log: "walletLoggedIn: true"
- Console log: "Wallet state set successfully"
- Generated wallet address appears in logs
- Page redirects to seed phrase backup screen

### Logging Into Existing Wallet

```javascript
// Fill password field
mcp__playwright__playwright_fill({
  selector: "input[type=\"password\"]",
  value: "TestPass123!"
})

// Click unlock button
mcp__playwright__playwright_click({
  selector: "button:has-text(\"Unlock\")"
})
```

**Success Indicators:**
- Console log: "LOGIN - Wallet unlocked successfully, session established"
- Main wallet interface appears
- Wallet address visible in header

## Advanced Interactions

### Using JavaScript Evaluation

```javascript
// Execute custom JavaScript
mcp__playwright__playwright_evaluate({
  script: `
    // Example: Clear form fields
    document.querySelectorAll('input[type="password"]').forEach(input => input.value = '');
    
    // Example: Check wallet state
    console.log('Current URL:', window.location.href);
    console.log('Local storage keys:', Object.keys(localStorage));
  `
})
```

### Monitoring Console Logs

```javascript
// Get recent console logs
mcp__playwright__playwright_console_logs({
  limit: 10,           // Number of logs to retrieve
  type: "error",       // Filter by type: "all", "error", "warning", "log", "info"
  search: "wallet"     // Search for specific text
})
```

**Important Log Patterns:**
- `🦀 Rust:` - Security-related operations in Rust code
- `LOGIN -` - Authentication events
- `🔍` - Debug information
- `✅` - Success operations
- `❌` - Error conditions
- `⚠` - Warnings

### Form Interactions

```javascript
// Fill input fields
mcp__playwright__playwright_fill({
  selector: "#fieldId",
  value: "input_value"
})

// Click buttons
mcp__playwright__playwright_click({
  selector: "button:has-text(\"Button Text\")"
})

// Select from dropdown
mcp__playwright__playwright_select({
  selector: "select#dropdown",
  value: "option_value"
})

// Hover over elements
mcp__playwright__playwright_hover({
  selector: ".hover-target"
})
```

## Navigation and Content

### Accessing Different Screens

```javascript
// Navigate to addresses screen
mcp__playwright__playwright_click({
  selector: ":text(\"Addresses\")"
})

// Go back to main screen
mcp__playwright__playwright_click({
  selector: ":text(\"Back\")"
})
```

### Getting Page Content

```javascript
// Get visible text
mcp__playwright__playwright_get_visible_text()

// Get HTML structure
mcp__playwright__playwright_get_visible_html({
  cleanHtml: true,
  maxLength: 10000
})
```

## Common Wallet Test Scenarios

### Complete Wallet Creation Flow

```javascript
// 1. Navigate to wallet
await mcp__playwright__playwright_navigate({url: "http://localhost:3003"});

// 2. Create wallet with strong password
await mcp__playwright__playwright_fill({selector: "#password", value: "TestPass123!"});
await mcp__playwright__playwright_fill({selector: "#confirmPassword", value: "TestPass123!"});
await mcp__playwright__playwright_click({selector: "button:has-text(\"Create Wallet & New Address\")"});

// 3. Take screenshot of result
await mcp__playwright__playwright_screenshot({name: "wallet_created", storeBase64: true});

// 4. Check console for success
await mcp__playwright__playwright_console_logs({limit: 10, search: "wallet"});
```

### Wallet Login Flow

```javascript
// 1. Refresh to logout (if needed)
await mcp__playwright__playwright_evaluate({script: "window.location.reload();"});

// 2. Wait for unlock screen and login
await mcp__playwright__playwright_fill({selector: "input[type=\"password\"]", value: "TestPass123!"});
await mcp__playwright__playwright_click({selector: "button:has-text(\"Unlock\")"});

// 3. Verify login success
await mcp__playwright__playwright_console_logs({limit: 5, search: "LOGIN"});
```

## Debugging and Troubleshooting

### Common Issues

1. **Button Not Clickable**
   - Check if button is disabled: Use `mcp__playwright__playwright_evaluate` to inspect button state
   - Wait for page to load: Add delays or check for element visibility

2. **Form Submission Fails**
   - Verify password requirements are met
   - Check console logs for validation errors
   - Ensure both password fields match exactly

3. **Page State Issues**
   - Use console logs to monitor wallet state changes
   - Take screenshots to visualize current state
   - Check localStorage for encrypted wallet data

### Debug Techniques

```javascript
// Inspect element state
mcp__playwright__playwright_evaluate({
  script: `
    const button = document.querySelector('button:contains("text")');
    console.log('Button disabled:', button?.disabled);
    console.log('Button classes:', button?.className);
  `
})

// Monitor network requests (if needed)
mcp__playwright__playwright_console_logs({type: "all", limit: 20})

// Check for React errors
mcp__playwright__playwright_console_logs({type: "error", limit: 10})
```

## Known Issues

### Seed Phrase Display Bug
- **Issue**: Seed phrase backup screen shows empty container
- **Root Cause**: Seed phrase parsing error "word count: 0"
- **Workaround**: Wallet functions normally, but seed backup is broken
- **Status**: Critical bug preventing wallet backup

### Password Validation
- **Issue**: Password fields may not sync properly
- **Solution**: Use specific IDs (`#password`, `#confirmPassword`)
- **Alternative**: Use JavaScript to set values directly

## Best Practices

1. **Always Monitor Console Logs**: They provide crucial debugging information
2. **Use Specific Selectors**: IDs are more reliable than generic selectors
3. **Take Screenshots**: Visual confirmation of state changes
4. **Handle Async Operations**: Some wallet operations take time to complete
5. **Verify Success**: Check both UI state and console logs for confirmation
6. **Test Happy Path First**: Ensure basic flows work before edge cases

## Example Session Persistence

The Playwright browser session persists throughout the conversation:
- Created wallets remain accessible
- Login state is maintained
- Local storage data persists
- Network requests continue in same context

This allows for comprehensive testing flows across multiple operations without losing state.

## Security Considerations

The wallet logs show extensive security measures:
- Rust WASM backend for cryptographic operations
- AES-256-GCM encryption for stored data
- PBKDF2 key derivation (100,000 iterations)
- Memory clearing after cryptographic operations
- No plaintext secrets in JavaScript context

When testing, respect these security boundaries and don't attempt to access encrypted data directly.