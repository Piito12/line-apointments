# LINE setup

[← Back to README](../README.md#english) · [ภาษาไทย](line.th.md)

### 1. LINE Official Account Manager (manager.line.biz)

Go to **Settings → Response settings**:

- **Webhooks** → **On**
- **Auto-response messages** → **Off** (otherwise LINE auto-replies on top of the agent)
- Greeting message can be on or off. It only affects new friends.

### 2. Open a tunnel so LINE can reach your machine

LINE cannot send webhooks to `localhost`; it needs a public URL. Open 2 terminal windows:

```bash
# Window 1
npm run dev

# Window 2
cloudflared tunnel --url http://localhost:2000
```

In the cloudflared log, look for the `Your quick Tunnel has been created!` box. It contains a URL like this:

```
https://xxxx-xxxx-xxxx.trycloudflare.com
```

### 3. Set the Webhook URL

Take the cloudflared URL, **append `/eve/v1/line`**, and enter it in LINE Developers Console → channel → **Messaging API** → **Webhook URL** (or on the Messaging API page of OA Manager):

```
https://xxxx-xxxx-xxxx.trycloudflare.com/eve/v1/line
```

- Click **Verify** → it must show **Success**
- Turn **Use webhook** on

### 4. Test

Message the OA from LINE on your phone. The agent replies (a little slower than a normal chat, because it waits for the model to finish and sends one message).

### About the tunnel

- **The URL changes every time you restart cloudflared.** Update the Webhook URL in LINE and click Verify again (restarting only `npm run dev` keeps the URL).
- **Close the tunnel when you are done testing** (Ctrl+C or `pkill cloudflared`). While it is open, anyone who knows the URL can call `/eve/v1/session` and talk to the agent, because `localDev()` in `agent/channels/eve.ts` accepts every request while `eve dev` runs. `/eve/v1/line` is safe because it checks signatures.
- Quick tunnels have no uptime guarantee. Use them for testing only, not production.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Dev server does not start | `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` missing from `.env.local`, or Node is not 24.x |
| Agent does not reply / model error | Not logged in to ChatGPT locally with `/login`, wrong API key, or expired OIDC token (run `npx eve link` again) |
| ChatGPT error on Vercel | Should not happen, because Vercel always uses the Gateway. If it does, check that the `VERCEL` env is set |
| Verify fails | Forgot to append `/eve/v1/line`, the tunnel or dev server is not running, or the URL is from an old tunnel |
| Messages get no reply | Use webhook is still Off, or the access token is wrong (check the `npm run dev` terminal log) |
| LINE sends its own auto-reply too | Auto-response messages are not turned off |
