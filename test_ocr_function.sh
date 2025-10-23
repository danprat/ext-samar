#!/bin/bash

# Quick Test for OCR Edge Function v18
# This script tests the new process-screenshot-question edge function

echo "🧪 Testing OCR Edge Function v18"
echo "================================="
echo ""

# Configuration
PROJECT_ID="ekqkwtxpjqqwjovekdqp"
FUNCTION_URL="https://${PROJECT_ID}.supabase.co/functions/v1/process-screenshot-question"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcWt3dHhwanFxd2pvdmVrZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDE5NjMsImV4cCI6MjA3NjI3Nzk2M30.Uq0ekLIjQ052wGixZI4qh1nzZoAkde7JuJSINAHXxTQ"

# Note: You need to replace USER_ACCESS_TOKEN with actual user token
echo "⚠️  Note: Replace USER_ACCESS_TOKEN with actual token from authenticated user"
echo ""

# Sample test payload (very small base64 image)
SAMPLE_IMAGE="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

echo "📋 Test Payload:"
echo "  - Image: 1x1 pixel sample"
echo "  - Coordinates: {x: 100, y: 100, width: 300, height: 200}"
echo ""

# Construct request
cat > test_payload.json <<EOF
{
  "image_data": "data:image/png;base64,${SAMPLE_IMAGE}",
  "coordinates": {
    "x": 100,
    "y": 100,
    "width": 300,
    "height": 200
  }
}
EOF

echo "🚀 Sending request to:"
echo "  ${FUNCTION_URL}"
echo ""

# Make request (requires user token)
if [ -z "$USER_ACCESS_TOKEN" ]; then
  echo "❌ Error: USER_ACCESS_TOKEN environment variable not set"
  echo ""
  echo "To test with actual user token:"
  echo "  export USER_ACCESS_TOKEN='your-token-here'"
  echo "  ./test_ocr_function.sh"
  echo ""
  echo "Or use curl directly:"
  echo ""
  echo "curl -X POST '${FUNCTION_URL}' \\"
  echo "  -H 'Authorization: Bearer {USER_TOKEN}' \\"
  echo "  -H 'apikey: ${ANON_KEY}' \\"
  echo "  -H 'Content-Type: application/json' \\"
  echo "  -d @test_payload.json"
  echo ""
  rm test_payload.json
  exit 1
fi

echo "🔄 Testing with user token..."
RESPONSE=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${USER_ACCESS_TOKEN}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d @test_payload.json)

# Parse response
echo "📥 Response:"
echo "${RESPONSE}" | jq '.'
echo ""

# Check if successful
SUCCESS=$(echo "${RESPONSE}" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "✅ Test PASSED"
  
  # Extract key info
  ANSWER=$(echo "${RESPONSE}" | jq -r '.answer')
  MODEL=$(echo "${RESPONSE}" | jq -r '.model_used')
  IMAGE_URL=$(echo "${RESPONSE}" | jq -r '.scan_area_data.image_url')
  PROCESSING_TIME=$(echo "${RESPONSE}" | jq -r '.processing_time')
  
  echo ""
  echo "📊 Summary:"
  echo "  - Answer: ${ANSWER}"
  echo "  - Model: ${MODEL}"
  echo "  - Processing Time: ${PROCESSING_TIME}ms"
  echo "  - Image URL: ${IMAGE_URL}"
  echo ""
  echo "🔗 Check uploaded image:"
  echo "  ${IMAGE_URL}"
else
  echo "❌ Test FAILED"
  ERROR=$(echo "${RESPONSE}" | jq -r '.error')
  echo "  Error: ${ERROR}"
fi

# Cleanup
rm test_payload.json

echo ""
echo "✨ Test completed"
