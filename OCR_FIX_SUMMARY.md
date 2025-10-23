# OCR Process Edge Function - Fixed ✅

## Perubahan yang Dilakukan

### 1. **Edge Function: `process-screenshot-question`**
- ✅ Deployed version 19 (with cropping support)
- ✅ Menggunakan **LiteLLM** dengan model `gemini/gemini-flash-lite-latest`
- ✅ API Key: `sk-OnClSdHqA9DHQ9MwQbBcoQ`
- ✅ Endpoint: `https://litellm.bisakerja.id/chat/completions`
- ✅ Backend cropping: Handles coordinates and crops image before upload

### 2. **Upload Screenshot ke Supabase Storage**
- ✅ Bucket: `question-images` (public)
- ✅ Path structure: `screenshots/{user_id}/{timestamp}.png`
- ✅ Max file size: 5MB
- ✅ Allowed formats: PNG, JPEG, JPG, WebP
- ✅ RLS policies:
  - Users can upload their own images
  - Anyone can view images (public bucket)
  - Users can delete their own images

### 3. **Single AI Process (No Separate OCR)**
Sebelumnya:
```
Screenshot → Mistral OCR (extract text) → LiteLLM (answer question)
```

Sekarang:
```
Screenshot → Upload to Storage → LiteLLM Vision (OCR + Answer in 1 call)
```

### 4. **API Request Format**
```bash
curl -X POST 'https://litellm.bisakerja.id/chat/completions' \
-H 'Authorization: Bearer sk-OnClSdHqA9DHQ9MwQbBcoQ' \
-H 'Content-Type: application/json' \
-d '{
  "model": "gemini/gemini-flash-lite-latest",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful AI assistant that answers questions concisely in JSON format."
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Jawab Soal tanpa penjelasan. Format response: {\"answer\": \"jawaban singkat\"}"
        },
        {
          "type": "image_url",
          "image_url": "{PUBLIC_URL_FROM_STORAGE}"
        }
      ]
    }
  ],
  "user": "OCR-Supabase"
}'
```

### 5. **Response Format**
```json
{
  "success": true,
  "answer": "Jawaban singkat",
  "formatted_answer": "Jawaban singkat",
  "scan_area_data": {
    "extracted_text": "Question text (if extracted)",
    "coordinates": { "x": 0, "y": 0, "width": 0, "height": 0 },
    "image_url": "https://ekqkwtxpjqqwjovekdqp.supabase.co/storage/v1/object/public/question-images/screenshots/{user_id}/{timestamp}.png"
  },
  "confidence": 90,
  "processing_time": 1234,
  "model_used": "gemini/gemini-flash-lite-latest",
  "user_type": "SCAN",
  "rate_limit_info": {
    "type": "PREMIUM",
    "minute": { "current": 1, "limit": 10, "remaining": 9 },
    "daily": { "current": 5, "limit": 1000, "remaining": 995 },
    "monthly": { "current": 50, "limit": 10000, "remaining": 9950 }
  }
}
```

### 6. **History Table**
Setiap request disimpan di table `history`:
- `user_id`: User yang melakukan request
- `question_text`: Text dari soal (extracted atau 'Screenshot question')
- `answer_text`: Jawaban dari AI
- `question_image_url`: **PUBLIC URL dari Supabase Storage**
- `created_at`: Timestamp

## Testing

Untuk test edge function:
```bash
# Test dengan extension langsung (scan area feature)
# Atau test dengan curl:

curl -X POST 'https://ekqkwtxpjqqwjovekdqp.supabase.co/functions/v1/process-screenshot-question' \
-H 'Authorization: Bearer {USER_ACCESS_TOKEN}' \
-H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcWt3dHhwanFxd2pvdmVrZHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDE5NjMsImV4cCI6MjA3NjI3Nzk2M30.Uq0ekLIjQ052wGixZI4qh1nzZoAkde7JuJSINAHXxTQ' \
-H 'Content-Type: application/json' \
-d '{
  "image_data": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "coordinates": { "x": 100, "y": 100, "width": 300, "height": 200 }
}'
```

## Benefits

1. ✅ **Lebih cepat**: Hanya 1 API call (bukan 2)
2. ✅ **Lebih akurat**: Gemini Flash Lite bisa langsung OCR + jawab
3. ✅ **Persistent storage**: Screenshot disimpan di Supabase Storage
4. ✅ **Better history**: User bisa review screenshot yang pernah di-scan
5. ✅ **Cost efficient**: 1 AI call instead of 2

## Next Steps

- [ ] Test dengan real screenshot dari extension
- [ ] Monitor logs untuk error handling
- [ ] Consider adding image compression before upload (optional)
- [ ] Consider cleanup policy untuk old screenshots (optional)

---

**Deployed**: October 23, 2025  
**Version**: 20 (fixed subscription validation)  
**Status**: ✅ Active

## Update Log

- **v18**: Initial LiteLLM + Supabase Storage integration
- **v19**: Added backend cropping support, removed local OCR dependency
- **v20**: Fixed subscription check to use `profiles.subscription_expires_at` (not `subscriptions` table)

## Database Structure

Database menggunakan model subscription di table `profiles`:
- **No separate `subscriptions` table**
- Subscription info stored in `profiles.subscription_expires_at`
- User has active subscription if `subscription_expires_at > NOW()`
- Plan type determined by expiry date:
  - `> 50 years from now` = PREMIUM (lifetime)
  - `< 50 years from now` = TRIAL/MONTHLY

## Grant Subscription to User

Use the SQL script `grant_subscription.sql`:

```sql
-- Grant lifetime subscription
UPDATE profiles 
SET subscription_expires_at = NOW() + INTERVAL '50 years'
WHERE email = 'user@example.com';
```
