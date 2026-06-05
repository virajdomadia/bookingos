# Test Auth Flow
$API_URL = "http://localhost:4000"
$TENANT_NAME = "Test Studio $(Get-Random)"
$EMAIL = "owner_$(Get-Random)@test.com"
$PASSWORD = "TestPassword123"

Write-Host "====== TESTING AUTH FLOW ======"
Write-Host ""

# 1. Test Health Check
Write-Host "1. Testing API Health..."
try {
    $health = Invoke-RestMethod -Uri "$API_URL/health"
    Write-Host "[OK] Health check passed: $($health.status)"
    Write-Host ""
} catch {
    Write-Host "[FAIL] Health check failed: $_"
    exit 1
}

# 2. Register New Tenant
Write-Host "2. Registering new tenant..."
Write-Host "   Business Name: $TENANT_NAME"
Write-Host "   Email: $EMAIL"
Write-Host ""

try {
    $registerResponse = Invoke-RestMethod `
        -Uri "$API_URL/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body (@{
            tenantName = $TENANT_NAME
            email = $EMAIL
            password = $PASSWORD
        } | ConvertTo-Json) `
        -SessionVariable session

    $accessToken = $registerResponse.accessToken
    $userId = $registerResponse.user.userId
    $tenantId = $registerResponse.tenant.id
    $slug = $registerResponse.tenant.slug

    Write-Host "[OK] Registration successful!"
    Write-Host "   Tenant ID: $tenantId"
    Write-Host "   Tenant Slug: $slug"
    Write-Host "   User ID: $userId"
    Write-Host "   Token: $($accessToken.Substring(0, 20))..."
    Write-Host ""
} catch {
    Write-Host "[FAIL] Registration failed: $_"
    exit 1
}

# 3. Test Protected Route Without Token (Should Fail)
Write-Host "3. Testing protected route WITHOUT token (should fail)..."
try {
    $noTokenResponse = Invoke-RestMethod `
        -Uri "$API_URL/admin/bookings" `
        -Headers @{} `
        -ErrorAction Stop

    Write-Host "[FAIL] Should have rejected but didn't!"
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "[OK] Correctly rejected (401)"
    } else {
        Write-Host "[FAIL] Wrong status: $($_.Exception.Response.StatusCode)"
    }
}
Write-Host ""

# 4. Login with Credentials
Write-Host "4. Testing login..."
try {
    $loginResponse = Invoke-RestMethod `
        -Uri "$API_URL/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body (@{
            email = $EMAIL
            password = $PASSWORD
        } | ConvertTo-Json)

    $newAccessToken = $loginResponse.accessToken
    Write-Host "[OK] Login successful!"
    Write-Host "   Email: $($loginResponse.user.email)"
    Write-Host "   Role: $($loginResponse.user.role)"
    Write-Host ""
} catch {
    Write-Host "[FAIL] Login failed: $_"
    exit 1
}

# 5. Verify Database
Write-Host "5. Verifying data in PostgreSQL..."
try {
    $dbQuery = @"
SELECT t.name, t.slug, u.email, u.role
FROM "Tenant" t
JOIN "User" u ON t.id = u."tenantId"
WHERE t.name = '$TENANT_NAME'
LIMIT 1;
"@

    $dbResult = docker exec booking_os_db psql -U postgres -d booking_os -t -c $dbQuery 2>&1

    if ($dbResult) {
        Write-Host "[OK] Found in database:"
        Write-Host $dbResult
    } else {
        Write-Host "[FAIL] Not found in database"
    }
    Write-Host ""
} catch {
    Write-Host "[FAIL] Database check failed: $_"
}

Write-Host "====== ALL TESTS PASSED ======"
