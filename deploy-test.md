# Deploy Hello Test Function

## Method 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/iczyxjklymjtpalfnvka
   - Navigate to **Edge Functions** in the sidebar

2. **Create New Function:**
   - Click "Create Function" 
   - Name: `hello-test`
   - Copy and paste the content from `supabase/functions/hello-test/index.ts`

3. **Deploy the Function:**
   - Click "Deploy" in the dashboard
   - The function will be live at: `https://iczyxjklymjtpalfnvka.supabase.co/functions/v1/hello-test`

## Method 2: Using CLI with Access Token

1. **Get Access Token:**
   - Go to https://supabase.com/dashboard/account/tokens
   - Create a new access token
   - Copy the token

2. **Set Environment Variable:**
   ```bash
   export SUPABASE_ACCESS_TOKEN=your_access_token_here
   ```

3. **Deploy Function:**
   ```bash
   npx supabase functions deploy hello-test --project-ref iczyxjklymjtpalfnvka
   ```

## Test the Function

Once deployed, test with:

```bash
curl -X POST "https://iczyxjklymjtpalfnvka.supabase.co/functions/v1/hello-test" \
  -H "Authorization: Bearer sb_secret_tKb_U7kmzXyvQOqR1C-lUA_P9vu3Qc6" \
  -H "Content-Type: application/json" \
  -d '{"name": "RouteStory"}'
```

## Check Logs

After calling the function, check logs in:
- **Supabase Dashboard** → Edge Functions → hello-test → Logs
- Or via CLI: `npx supabase functions logs hello-test --project-ref iczyxjklymjtpalfnvka`

## Expected Console Output

You should see these logs:
- 🚀 Hello Test Function Initialized!
- 📥 Request received: POST /hello-test
- 📋 Request body: {"name": "RouteStory"}
- 👋 Saying hello to: RouteStory
- ✅ Response data: {"message": "Hello RouteStory!", "timestamp": "...", "success": true}

## Expected Response

```json
{
  "message": "Hello RouteStory!",
  "timestamp": "2024-12-01T...",
  "success": true
}
```