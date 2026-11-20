# Deploy to Vercel

[← Back to README](../README.md#english) · [ภาษาไทย](deploy.th.md)

**Option 1: Deploy button.** Click Deploy with Vercel in the [README](../README.md) → choose a scope → enter the secrets (LINE, Google, `AI_PROVIDER` and `AI_API_KEY`) → Deploy (Vercel clones the repo into a new repo in your account and redeploys on every push).

**Option 2: CLI from this machine**

```bash
npx eve link --non-interactive --project clinic-appointment
# add the secrets one by one (you are prompted for each value; never type it in the command)
npx vercel env add LINE_CHANNEL_SECRET production
npx vercel env add LINE_CHANNEL_ACCESS_TOKEN production
npx vercel env add GOOGLE_CLIENT_EMAIL production
npx vercel env add GOOGLE_PRIVATE_KEY production
npx vercel env add GOOGLE_CALENDAR_ID production
npx vercel env add AI_PROVIDER production        # anthropic | openai | gateway
npx vercel env add AI_API_KEY production
npx vercel env add CONFIG_SHEET_ID production   # optional, if shop data comes from a Google Sheet
npx eve deploy --non-interactive --yes
```

### After deploying

1. Check the app is up: `curl https://<project>.vercel.app/eve/v1/health`
2. Change the Webhook URL in LINE Developers Console to `https://<project>.vercel.app/eve/v1/line` → **Verify** → turn on **Use webhook**
3. After changing env values later, **Redeploy** for them to take effect
4. If Deployment Protection is on, LINE cannot call the webhook. Turn it off for Production or use Protection Bypass
5. **Change the AI provider or model:** edit `AI_PROVIDER` (`anthropic` · `openai` · `gateway`), `AI_API_KEY` and optionally `AI_MODEL` in Vercel → Project → **Settings → Environment Variables**, then **Redeploy**. See [Model selection](configuration.md#model-selection).
