# Co-borrower API Test Script
# PowerShell script to test all co-borrower routes

# Configuration
$baseUrl = "http://localhost:5000/api"
$token = ""  # Will be set after login

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Co-borrower API Testing Suite" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Function to make API requests
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [hashtable]$Headers = @{},
        [string]$ContentType = "application/json"
    )
    
    $url = "$baseUrl$Endpoint"
    
    if ($token) {
        $Headers["Authorization"] = "Bearer $token"
    }
    
    try {
        $params = @{
            Uri = $url
            Method = $Method
            Headers = $Headers
        }
        
        if ($Body -and $Method -ne "GET") {
            if ($ContentType -eq "application/json") {
                $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
                $params["ContentType"] = "application/json"
            } else {
                $params["Body"] = $Body
                $params["ContentType"] = $ContentType
            }
        }
        
        $response = Invoke-RestMethod @params
        return @{
            Success = $true
            Data = $response
            StatusCode = 200
        }
    }
    catch {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        return @{
            Success = $false
            Error = if ($errorDetails) { $errorDetails } else { $_.Exception.Message }
            StatusCode = $_.Exception.Response.StatusCode.value__
        }
    }
}

# Test Results Storage
$testResults = @()

function Add-TestResult {
    param(
        [string]$TestName,
        [string]$Route,
        [string]$Method,
        [bool]$Passed,
        [string]$Message,
        [object]$Response = $null
    )
    
    $testResults += [PSCustomObject]@{
        TestName = $TestName
        Route = $Route
        Method = $Method
        Passed = $Passed
        Message = $Message
        Response = $Response
    }
    
    $status = if ($Passed) { "[PASS]" } else { "[FAIL]" }
    $color = if ($Passed) { "Green" } else { "Red" }
    
    Write-Host "$status $Method $Route" -ForegroundColor $color
    Write-Host "      $Message" -ForegroundColor Gray
    Write-Host ""
}

# ============================================================================
# 1. AUTHENTICATION (Required for testing)
# ============================================================================

Write-Host "Step 1: Authentication" -ForegroundColor Yellow
Write-Host "NOTE: You need to authenticate first. Please provide:" -ForegroundColor Cyan
Write-Host "  - Email:" -ForegroundColor White
$email = Read-Host
Write-Host "  - Password:" -ForegroundColor White
$password = Read-Host -AsSecureString
$passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

$loginBody = @{
    email = $email
    password = $passwordPlain
}

$loginResult = Invoke-ApiRequest -Method "POST" -Endpoint "/students/login" -Body $loginBody

if ($loginResult.Success) {
    $token = $loginResult.Data.token
    Write-Host "[SUCCESS] Authenticated successfully!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[ERROR] Authentication failed. Cannot proceed with tests." -ForegroundColor Red
    Write-Host "Error: $($loginResult.Error)" -ForegroundColor Red
    exit
}

# ============================================================================
# 2. LIST ALL CO-BORROWERS
# ============================================================================

Write-Host "Step 2: Testing GET /api/coborrower/list" -ForegroundColor Yellow

$result = Invoke-ApiRequest -Method "GET" -Endpoint "/coborrower/list"

if ($result.Success) {
    $count = $result.Data.count
    Add-TestResult -TestName "List Co-borrowers" -Route "/coborrower/list" -Method "GET" `
        -Passed $true -Message "Found $count co-borrower(s)" -Response $result.Data
} else {
    Add-TestResult -TestName "List Co-borrowers" -Route "/coborrower/list" -Method "GET" `
        -Passed $false -Message "Error: $($result.Error)" -Response $result.Error
}

# Store co-borrower ID if available for subsequent tests
$coBorrowerId = $null
if ($result.Success -and $result.Data.data.Count -gt 0) {
    $coBorrowerId = $result.Data.data[0]._id
    Write-Host "Using Co-borrower ID: $coBorrowerId for subsequent tests" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================================================
# 3. GET SINGLE CO-BORROWER (if ID available)
# ============================================================================

if ($coBorrowerId) {
    Write-Host "Step 3: Testing GET /api/coborrower/:id" -ForegroundColor Yellow
    
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/coborrower/$coBorrowerId"
    
    if ($result.Success) {
        $name = $result.Data.coBorrower.fullName
        $kycStatus = $result.Data.coBorrower.kycStatus
        $financialStatus = $result.Data.coBorrower.financialStatus
        
        Add-TestResult -TestName "Get Co-borrower Details" -Route "/coborrower/$coBorrowerId" -Method "GET" `
            -Passed $true -Message "Retrieved: $name (KYC: $kycStatus, Financial: $financialStatus)" -Response $result.Data
    } else {
        Add-TestResult -TestName "Get Co-borrower Details" -Route "/coborrower/$coBorrowerId" -Method "GET" `
            -Passed $false -Message "Error: $($result.Error)" -Response $result.Error
    }
} else {
    Write-Host "Step 3: SKIPPED - No co-borrower ID available" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================================================
# 4. GET FINANCIAL STATUS (if ID available)
# ============================================================================

if ($coBorrowerId) {
    Write-Host "Step 4: Testing GET /api/coborrower/:id/financial/status" -ForegroundColor Yellow
    
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/coborrower/$coBorrowerId/financial/status"
    
    if ($result.Success) {
        $status = $result.Data.data.status
        $confidence = $result.Data.data.confidence
        
        Add-TestResult -TestName "Get Financial Status" -Route "/coborrower/$coBorrowerId/financial/status" -Method "GET" `
            -Passed $true -Message "Status: $status, Confidence: $confidence" -Response $result.Data
    } else {
        Add-TestResult -TestName "Get Financial Status" -Route "/coborrower/$coBorrowerId/financial/status" -Method "GET" `
            -Passed $false -Message "Error: $($result.Error)" -Response $result.Error
    }
} else {
    Write-Host "Step 4: SKIPPED - No co-borrower ID available" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================================================
# 5. GET FINANCIAL ANALYSIS (if ID available)
# ============================================================================

if ($coBorrowerId) {
    Write-Host "Step 5: Testing GET /api/coborrower/:id/financial/analysis" -ForegroundColor Yellow
    
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/coborrower/$coBorrowerId/financial/analysis"
    
    if ($result.Success) {
        Add-TestResult -TestName "Get Financial Analysis" -Route "/coborrower/$coBorrowerId/financial/analysis" -Method "GET" `
            -Passed $true -Message "Analysis retrieved successfully" -Response $result.Data.data.analysis
    } else {
        # This might fail if no financial data exists, which is expected
        $message = if ($result.StatusCode -eq 404) { "No analysis available (expected if no financial docs uploaded)" } else { "Error: $($result.Error)" }
        Add-TestResult -TestName "Get Financial Analysis" -Route "/coborrower/$coBorrowerId/financial/analysis" -Method "GET" `
            -Passed ($result.StatusCode -eq 404) -Message $message -Response $result.Error
    }
} else {
    Write-Host "Step 5: SKIPPED - No co-borrower ID available" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================================================
# 6. TEST DEPRECATED ENDPOINT
# ============================================================================

if ($coBorrowerId) {
    Write-Host "Step 6: Testing POST /api/coborrower/:id/financial/process (DEPRECATED)" -ForegroundColor Yellow
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/coborrower/$coBorrowerId/financial/process"
    
    if (!$result.Success -and $result.StatusCode -eq 410) {
        Add-TestResult -TestName "Deprecated Endpoint" -Route "/coborrower/$coBorrowerId/financial/process" -Method "POST" `
            -Passed $true -Message "Correctly returns 410 Gone" -Response $result.Error
    } else {
        Add-TestResult -TestName "Deprecated Endpoint" -Route "/coborrower/$coBorrowerId/financial/process" -Method "POST" `
            -Passed $false -Message "Should return 410 Gone status" -Response $result
    }
} else {
    Write-Host "Step 6: SKIPPED - No co-borrower ID available" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================================================
# 7. TEST ERROR HANDLING - Invalid ID
# ============================================================================

Write-Host "Step 7: Testing Error Handling (Invalid ID)" -ForegroundColor Yellow

$invalidId = "invalid-id-12345"
$result = Invoke-ApiRequest -Method "GET" -Endpoint "/coborrower/$invalidId"

if (!$result.Success) {
    Add-TestResult -TestName "Invalid ID Handling" -Route "/coborrower/$invalidId" -Method "GET" `
        -Passed $true -Message "Correctly returns error for invalid ID" -Response $result.Error
} else {
    Add-TestResult -TestName "Invalid ID Handling" -Route "/coborrower/$invalidId" -Method "GET" `
        -Passed $false -Message "Should return error for invalid ID" -Response $result.Data
}

# ============================================================================
# 8. GENERATE SUMMARY REPORT
# ============================================================================

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$totalTests = $testResults.Count
$passedTests = ($testResults | Where-Object { $_.Passed }).Count
$failedTests = $totalTests - $passedTests

Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host ""

if ($failedTests -gt 0) {
    Write-Host "Failed Tests:" -ForegroundColor Red
    $testResults | Where-Object { !$_.Passed } | ForEach-Object {
        Write-Host "  - $($_.TestName): $($_.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "================================" -ForegroundColor Cyan
Write-Host "NOTES:" -ForegroundColor Yellow
Write-Host "- KYC routes NOT tested (KYC agent on port 5001 is not running)" -ForegroundColor Yellow
Write-Host "- To test KYC routes, start: python app.py in singular-agents/kyc" -ForegroundColor Yellow
Write-Host "- Financial upload routes need actual PDF files to test" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Cyan

# Save results to file
$testResults | ConvertTo-Json -Depth 10 | Out-File -FilePath "co-borrower-test-results.json"
Write-Host ""
Write-Host "Full test results saved to: co-borrower-test-results.json" -ForegroundColor Green
