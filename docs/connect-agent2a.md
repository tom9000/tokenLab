# Connect Agent 2.0a - Step-by-Step User Guide

This guide provides clear, step-by-step instructions for using the Connect Agent 2.0 authenticated agent mode to avoid common errors and ensure successful deployment.

## Prerequisites

Before starting, ensure you have:

1. **SAFU Wallet Running**: SAFU wallet must be running at `http://localhost:3003`
2. **Token Lab Running**: Token Lab must be running at `http://localhost:3005`
3. **Both Applications Updated**: Both applications should be using stellar-sdk v14.0.0-rc.3 or later
4. **Network Access**: Both applications can communicate via localhost

## Quick Start Guide

### Option 1: Mock Mode (Recommended for Testing)

This is the simplest way to test the agent functionality without complex setup.

**Step 1: Start Applications**
```bash
# Terminal 1: Start SAFU Wallet
cd /Users/Mac/code/-scdev/safu-dev
npm run dev

# Terminal 2: Start Token Lab  
cd /Users/Mac/code/-scdev/tokenLab
npm run dev
```

**Step 2: Connect Agent**
1. Open Token Lab at `http://localhost:3005`
2. Click the **"Connect Agent"** button (blue button in the header)
3. When prompted for password, enter: `password123`
4. Wait 2-3 seconds for connection to complete

**Step 3: Verify Connection**
You should see:
- ✅ A **"Disconnect"** button appears (replacing Connect Agent)
- ✅ **"🤖 AGENT MODE"** indicator appears next to wallet address
- ✅ Wallet address shows: `GDJVKVE36C22RRNRUL7KKWHSGRKGY6QA5HTTEFCAQLTVG4HKEYI4O5DN`
- ✅ Logs show: `✅ Successfully connected to SAFU wallet (Agent)`

**Step 4: Deploy Token**
1. Fill in token details (Name, Symbol, etc.)
2. Click **"Deploy SEP-41 Token"**
3. The transaction will be signed automatically with the agent (no popup)
4. Monitor logs for deployment progress

### Option 2: Real Seed Mode (Advanced)

For production-like testing with a real seed phrase.

**Step 1: Set up SAFU Wallet with Specific Seed**
```bash
curl -X POST http://localhost:3003/api/setup-wallet \
  -H "Content-Type: application/json" \
  -d '{
    "seedPhrase": "humor initial toddler bitter elite fury gospel addict water cattle slush card",
    "password": "TestPass123!",
    "appName": "Token Lab",
    "origin": "http://localhost:3005",
    "mode": "agent"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Wallet setup complete for agent mode",
  "publicKey": "GU5STX7HQYAJRZBKS2CLT3DMU4ENV5FOW6GPX7HQYAJRZBKS2CLT3DMU",
  "network": "futurenet"
}
```

**Step 2: Connect Agent with Real Seed**
1. Open Token Lab at `http://localhost:3005`
2. Click **"Connect Agent"**
3. Enter password: `TestPass123!`
4. Wait for connection to complete

**Step 3: Verify Real Seed Connection**
- ✅ Wallet address shows: `GU5STX7HQYAJRZBKS2CLT3DMU4ENV5FOW6GPX7HQYAJRZBKS2CLT3DMU`
- ✅ Agent mode indicator appears
- ✅ Logs show successful authentication

## Success Indicators

### ✅ Connection Successful
When agent connection works properly, you will see:

**In the UI:**
- **Disconnect** button appears (instead of Connect Agent)
- **🤖 AGENT MODE** badge appears next to wallet address
- **"Programmatic control active"** text under the badge
- **Wallet address** is displayed (starts with G, 56 characters)

**In the Logs:**
```
[14:56:21] 🤖 [AGENT] ✅ Connecting to SAFU wallet programmatically...
[14:56:22] 🤖 [AGENT] ✅ Using pre-configured credentials for automation
[14:56:23] 🤖 [AGENT] ✅ Session established via API
[14:56:24] 🤖 [AGENT] ✅ Successfully connected to SAFU wallet (Agent)
[14:56:25] 🤖 [AGENT] Ready for automated deployment!
```

**In Browser Console:**
```
[TOKEN_LAB_AGENT] 14:56:21 - Connecting to SAFU wallet programmatically...
[TOKEN_LAB_AGENT] 14:56:22 - Authentication successful
[TOKEN_LAB_AGENT] 14:56:23 - Session established
```

### ✅ Deployment Successful
When agent deployment works properly:

**In the Logs:**
```
[14:57:01] 🤖 [AGENT] ℹ️ Signing transaction programmatically with agent...
[14:57:02] 🤖 [AGENT] ✅ Transaction signed successfully!
[14:57:03] 🤖 [AGENT] ✅ Token deployed successfully
```

**No Popup Windows**: Agent mode signs transactions programmatically without user popups

## Troubleshooting Common Issues

### ❌ Issue: "Agent connection cancelled - authentication required"

**Cause**: Password prompt was cancelled or empty password provided

**Solution**:
- **Mock Mode**: Use password `password123`
- **Real Seed Mode**: Use password `TestPass123!`
- Don't cancel the password prompt - enter the password and press OK/Enter

### ❌ Issue: "Authentication failed: Invalid password"

**Mock Mode Solutions**:
- Try password: `password123`
- Try any simple password like: `test123`

**Real Seed Mode Solutions**:
- Use exact password: `TestPass123!`
- Ensure you ran the setup-wallet command first
- Verify the setup command returned `"success": true`

### ❌ Issue: "Make sure SAFU wallet is running at localhost:3003"

**Solution**:
```bash
# Check if SAFU wallet is running
curl http://localhost:3003/api/health

# If not running, start it:
cd /Users/Mac/code/-scdev/safu-dev
npm run dev
```

### ❌ Issue: Connection hangs or times out

**Troubleshooting Steps**:
1. **Refresh both applications**
2. **Check browser console** for error messages (F12 → Console)
3. **Verify API endpoints**:
   ```bash
   # Test auth endpoint
   curl -X POST http://localhost:3003/api/auth \
     -H "Content-Type: application/json" \
     -d '{"password": "password123", "appName": "Token Lab", "origin": "http://localhost:3005", "mode": "agent"}'
   ```
4. **Clear browser cache** if issues persist

### ❌ Issue: Deployment fails with "Please connect wallet first"

**Cause**: Agent connection didn't complete properly

**Solution**:
1. Look for the **Disconnect button** - if it's not there, connection failed
2. Check for **🤖 AGENT MODE** indicator
3. Try disconnecting and reconnecting
4. Verify authentication logs show success

## Automation Setup

### For CI/CD or Automated Testing

Set up pre-configured password to avoid interactive prompts:

**JavaScript/Browser Automation:**
```javascript
// Set password before clicking Connect Agent
window.__SAFU_AGENT_PASSWORD__ = 'password123'; // For mock mode
// OR
window.__SAFU_AGENT_PASSWORD__ = 'TestPass123!'; // For real seed mode

// Now click Connect Agent - it will use the pre-configured password
document.querySelector('button:contains("Connect Agent")').click();
```

**Playwright/Automation Example:**
```javascript
// Set up automation password
await page.evaluate(() => {
  window.__SAFU_AGENT_PASSWORD__ = 'password123';
});

// Click Connect Agent
await page.locator('button:has-text("Connect Agent")').click();

// Wait for connection
await page.waitForSelector('text=Disconnect');
```

## API Reference Quick Guide

### Authentication Flow
1. `POST /api/auth` - Authenticate with wallet password
2. `POST /api/connect` - Establish agent connection with session data
3. `POST /api/sign` - Sign transactions programmatically

### Mock Mode Authentication
```bash
curl -X POST http://localhost:3003/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "password": "password123",
    "appName": "Token Lab",
    "origin": "http://localhost:3005", 
    "mode": "agent"
  }'
```

### Real Seed Mode Authentication
```bash
curl -X POST http://localhost:3003/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "password": "TestPass123!",
    "appName": "Token Lab",
    "origin": "http://localhost:3005",
    "mode": "agent",
    "encryptedSeed": "{\"version\":\"2.0\",\"algorithm\":\"AES-256-GCM-mock\",\"seedHash\":8182,\"originalSeed\":\"humor initial toddler bitter elite fury gospel addict water cattle slush card\",\"timestamp\":1753718100128}"
  }'
```

## Best Practices

### Security
- ✅ **Never store passwords** in localStorage or persistent storage
- ✅ **Use pre-configured passwords** only for automation/testing
- ✅ **Clear passwords** from memory after use
- ✅ **Validate origins** for postMessage communications

### Development Workflow
1. **Start with Mock Mode** for initial testing
2. **Use Real Seed Mode** for production-like testing
3. **Monitor logs** for detailed debugging information
4. **Test both manual and automated flows**

### Error Handling
- ✅ **Always check for success indicators** (Disconnect button, Agent mode badge)
- ✅ **Monitor console logs** for authentication details
- ✅ **Handle timeout scenarios** (30-second max authentication time)
- ✅ **Provide fallback options** for failed authentication

## Testing Checklist

Before deploying or using in production, verify:

- [ ] SAFU wallet starts successfully at localhost:3003
- [ ] Token Lab starts successfully at localhost:3005
- [ ] Connect Agent button appears and is clickable
- [ ] Password prompt appears and accepts correct password
- [ ] Disconnect button appears after successful connection
- [ ] 🤖 AGENT MODE indicator shows when connected
- [ ] Wallet address displays correctly
- [ ] Deploy SEP-41 Token works without popup
- [ ] Transaction logs show agent signing activity
- [ ] Both mock mode and real seed mode work (if using real seed)

## Support

If you encounter issues not covered in this guide:

1. **Check the logs** in Token Lab for detailed error messages
2. **Verify API endpoints** are responding correctly
3. **Test authentication manually** using curl commands
4. **Review browser console** for JavaScript errors
5. **Ensure SDK versions** are compatible (v14.0.0-rc.3+)

For additional technical details, see the complete specification in `docs/connect-agent2.md`.