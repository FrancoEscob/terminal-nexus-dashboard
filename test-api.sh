#!/bin/bash

# Test script for Terminal Nexus Dashboard Phase 1 API

echo "🧪 Testing Terminal Nexus Dashboard - Phase 1 API"
echo "=================================================="

BASE_URL="http://localhost:3000"

# Test 1: Health Check
echo -e "\n1️⃣ Testing health endpoint..."
curl -s "$BASE_URL/api/health" | jq '.'

# Test 2: Create a shell session
echo -e "\n2️⃣ Creating shell session..."
SESSION_ID=$(curl -s -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "shell",
    "workdir": "/tmp",
    "name": "test-shell-session"
  }' | jq -r '.data.id')

echo "Created session: $SESSION_ID"

# Test 3: List all sessions
echo -e "\n3️⃣ Listing all sessions..."
curl -s "$BASE_URL/api/sessions" | jq '.'

# Test 4: Get session details
echo -e "\n4️⃣ Getting session details..."
curl -s "$BASE_URL/api/sessions/$SESSION_ID" | jq '.'

# Test 5: Resize session
echo -e "\n5️⃣ Resizing session..."
curl -s -X POST "$BASE_URL/api/sessions/$SESSION_ID/resize" \
  -H "Content-Type: application/json" \
  -d '{"cols": 100, "rows": 30}' | jq '.'

# Wait a bit
echo -e "\n⏳ Waiting 2 seconds..."
sleep 2

# Test 6: Restart session
echo -e "\n6️⃣ Restarting session..."
curl -s -X POST "$BASE_URL/api/sessions/$SESSION_ID/restart" | jq '.'

# Test 7: Kill session
echo -e "\n7️⃣ Killing session..."
curl -s -X DELETE "$BASE_URL/api/sessions/$SESSION_ID" | jq '.'

echo -e "\n✅ API testing complete!"
echo "Note: WebSocket testing requires a WebSocket client"
