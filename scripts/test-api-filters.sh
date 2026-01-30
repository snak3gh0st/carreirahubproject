#!/bin/bash

# API Filter Testing Script
# Tests the /api/dashboard/metrics endpoint with various date filters
# Usage: ./scripts/test-api-filters.sh

API_BASE="${API_BASE:-http://localhost:3000}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          API Filter Integration Test                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Testing API: $API_BASE/api/dashboard/metrics"
echo ""
echo "NOTE: This requires:"
echo "  1. Dev server running: npm run dev"
echo "  2. Database accessible"
echo "  3. Authentication may return 401 (expected for unauthenticated requests)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test function
test_filter() {
  local filter_name="$1"
  local url="$2"
  
  echo -n "▸ Testing $filter_name... "
  
  response=$(curl -s -w "\n%{http_code}" "$url")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  case $http_code in
    200)
      echo "✓ PASS (200 OK)"
      # Check if response has expected structure
      if echo "$body" | grep -q '"sales"' && echo "$body" | grep -q '"finance"'; then
        echo "  └─ Response structure valid"
      else
        echo "  └─ ⚠ Warning: Unexpected response structure"
      fi
      ;;
    401)
      echo "⚠ AUTH (401 Unauthorized)"
      echo "  └─ Endpoint reachable but requires authentication"
      ;;
    404)
      echo "✗ FAIL (404 Not Found)"
      echo "  └─ Endpoint not found - check route configuration"
      return 1
      ;;
    500)
      echo "✗ FAIL (500 Server Error)"
      echo "  └─ Server error - check logs"
      return 1
      ;;
    000)
      echo "✗ FAIL (Connection refused)"
      echo "  └─ Is dev server running? (npm run dev)"
      return 1
      ;;
    *)
      echo "✗ FAIL (HTTP $http_code)"
      echo "  └─ Unexpected status code"
      return 1
      ;;
  esac
  
  return 0
}

# Test each date range filter
echo "Date Range Filters:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_filter "last7" "$API_BASE/api/dashboard/metrics?dateRange=last7"
test_filter "last30" "$API_BASE/api/dashboard/metrics?dateRange=last30"
test_filter "last90" "$API_BASE/api/dashboard/metrics?dateRange=last90"
test_filter "thisYear" "$API_BASE/api/dashboard/metrics?dateRange=thisYear"
test_filter "allTime" "$API_BASE/api/dashboard/metrics?dateRange=allTime"
echo ""

echo "Default Behavior:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_filter "no params" "$API_BASE/api/dashboard/metrics"
echo ""

echo "Combined Filters:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_filter "dateRange + segment" "$API_BASE/api/dashboard/metrics?dateRange=thisYear&segment=active"
test_filter "dateRange + invoiceStatus" "$API_BASE/api/dashboard/metrics?dateRange=last30&invoiceStatus=PAID,OVERDUE"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test Summary:"
echo "  ✓ = Working correctly"
echo "  ⚠ = Requires authentication (expected)"
echo "  ✗ = Error or issue detected"
echo ""
echo "Next steps:"
echo "  1. If you see connection errors, start dev server: npm run dev"
echo "  2. For authenticated tests, use browser DevTools Network tab"
echo "  3. Check browser console for client-side errors"
echo ""
