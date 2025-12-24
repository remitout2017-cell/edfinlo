# Co-borrower API Testing Instructions

## Setup

1. **Install REST Client Extension** (if not already installed)

   - Extension ID: `humao.rest-client`
   - Or use Thunder Client

2. **Open the test file**: `test-coborrower.http`

3. **Update Variables** at the top of the file:
   ```
   @token = YOUR_AUTH_TOKEN_HERE
   @coBorrowerId = YOUR_COBORROWER_ID_HERE
   ```

## Testing Steps

### Step 1: Authenticate

1. Update your email and password in request #1
2. Click "Send Request" above the request
3. Copy the `token` from the response
4. Paste it into the `@token` variable at the top

### Step 2: Test Basic Routes

Run these in order:

- Request #2: List all co-borrowers
- Copy a co-borrower ID and paste into `@coBorrowerId` variable
- Request #3: Get co-borrower details

### Step 3: Test KYC Routes (Optional)

⚠️ Requires KYC agent running on port 5001

Start the KYC agent:

```powershell
cd c:\project-version-1\singular-agents\kyc
python app.py
```

Then run:

- Request #4: Submit new KYC (requires image files)
- Request #5: Re-verify KYC

### Step 4: Test Financial Routes

⚠️ Requires actual PDF files in `./test-files/` folder

- Request #6: Upload financial documents
- Request #7: Get financial status
- Request #8: Get complete analysis
- Request #9 or #10: Reset financial data

### Step 5: Test Errors

- Request #12: Invalid ID (should fail gracefully)
- Request #13: Deprecated endpoint (should return 410)
- Request #14: No auth token (should return 401)

### Step 6: Health Checks

- Request #15: Backend health
- Request #16: Financial agent health
- Request #17: KYC agent health

## Expected Results

### ✅ Successful Responses

**List Co-borrowers** (200):

```json
{
  "success": true,
  "count": 2,
  "data": [
    /* array of co-borrowers */
  ]
}
```

**Get Co-borrower** (200):

```json
{
  "success": true,
  "coBorrower": {
    "fullName": "John Doe",
    "kycStatus": "verified",
    "financialSummary": {
      /* metrics */
    }
  }
}
```

**Financial Upload** (200):

```json
{
  "success": true,
  "status": "verified",
  "analysis": {
    "foir": { "percentage": 31.25, "status": "excellent" },
    "cibil": { "estimatedScore": 750 }
  }
}
```

### ❌ Error Responses

**Invalid ID** (404):

```json
{
  "success": false,
  "message": "Co-borrower not found"
}
```

**Deprecated Endpoint** (410):

```json
{
  "success": false,
  "message": "This endpoint is deprecated..."
}
```

**No Auth** (401):

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

## Notes

- File uploads require actual files in `./test-files/` directory
- Place your test documents there:

  - `aadhaar_front.jpg`
  - `aadhaar_back.jpg`
  - `pan_front.jpg`
  - `salary_slips.pdf`
  - `bank_statement.pdf`
  - `itr_1.pdf`

- KYC routes won't work unless the KYC agent is running
- Financial uploads process in real-time (may take 30-60 seconds)

## Quick Test (No Files Needed)

Just want to verify the API is working? Run these:

1. Request #1 (Login)
2. Request #2 (List)
3. Request #3 (Get details)
4. Request #7 (Financial status)
5. Request #15-17 (Health checks)

These don't require file uploads!
