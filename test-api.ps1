# Test script for Terminal Nexus Dashboard Phase 1 API (PowerShell)

Write-Host "🧪 Testing Terminal Nexus Dashboard - Phase 1 API" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$BASE_URL = "http://localhost:3000"

# Helper function for pretty JSON
function Format-Json($json) {
    try {
        $json | ConvertFrom-Json | ConvertTo-Json -Depth 10
    } catch {
        $json
    }
}

# Test 1: Health Check
Write-Host "`n1️⃣ Testing health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/health" -Method GET
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Create a shell session
Write-Host "`n2️⃣ Creating shell session..." -ForegroundColor Yellow
try {
    $body = @{
        type = "shell"
        workdir = "C:\temp"  # Windows path
        name = "test-shell-session"
    } | ConvertTo-Json -Depth 10

    $response = Invoke-RestMethod -Uri "$BASE_URL/api/sessions" -Method POST -ContentType "application/json" -Body $body
    $SESSION_ID = $response.data.id
    Write-Host "Created session: $SESSION_ID"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    $SESSION_ID = $null
}

# Test 3: List all sessions
Write-Host "`n3️⃣ Listing all sessions..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/sessions" -Method GET
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Get session details
if ($SESSION_ID) {
    Write-Host "`n4️⃣ Getting session details..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/sessions/$SESSION_ID" -Method GET
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Test 5: Resize session
    Write-Host "`n5️⃣ Resizing session..." -ForegroundColor Yellow
    try {
        $body = @{
            cols = 100
            rows = 30
        } | ConvertTo-Json -Depth 10
        
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/sessions/$SESSION_ID/resize" -Method POST -ContentType "application/json" -Body $body
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Wait a bit
    Write-Host "`n⏳ Waiting 2 seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds 2

    # Test 6: Restart session
    Write-Host "`n6️⃣ Restarting session..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/sessions/$SESSION_ID/restart" -Method POST
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    # Test 7: Kill session
    Write-Host "`n7️⃣ Killing session..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/sessions/$SESSION_ID" -Method DELETE
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n✅ API testing complete!" -ForegroundColor Green
Write-Host "Note: WebSocket testing requires a WebSocket client" -ForegroundColor Gray
