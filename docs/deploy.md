# Deploy to Vercel

[← Back to README](../README.md#english) · [ภาษาไทย](deploy.th.md)

**Option 1: Deploy button.** Click Deploy with Vercel in the [README](../README.md) → choose a scope → enter the 4 secrets → Deploy (Vercel clones the repo into a new repo in your account and redeploys on every push).

**Option 2: CLI from this machine**

```bash
npx eve link --non-interactive --project clinic-appointment
# add the secrets one by one (you are prompted for each value; never type it in the command)
npx vercel env add LINE_CHANNEL_SECRET production
npx vercel env add LINE_CHANNEL_ACCESS_TOKEN production
npx vercel env add GOOGLE_SERVICE_ACCOUNT_KEY production
npx vercel env add GOOGLE_CALENDAR_ID production
npx vercel env add CONFIG_SHEET_ID production   # optional, if shop data comes from a Google Sheet
npx eve deploy --non-interactive --yes
```

### After deploying

1. Check the app is up: `curl https://<project>.vercel.app/eve/v1/health`
2. Change the Webhook URL in LINE Developers Console to `https://<project>.vercel.app/eve/v1/line` → **Verify** → turn on **Use webhook**
3. After changing env values later, **Redeploy** for them to take effect
4. If Deployment Protection is on, LINE cannot call the webhook. Turn it off for Production or use Protection Bypass
