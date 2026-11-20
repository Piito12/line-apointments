# Environment variables and model selection

[← Back to README](../README.md#english) · [ภาษาไทย](configuration.th.md)

Every value is a secret. **Never commit them.** For local runs, put them in `.env.local` (already ignored by git). For deployments, add them in Vercel → Project → **Settings → Environment Variables** (the Deploy button asks for the first 4 when it creates the project).

| Variable | Required | For |
|---|---|---|
| `LINE_CHANNEL_SECRET` | ✅ | Verifying LINE webhook signatures |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | Sending replies to customers |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Recommended | The service account's JSON key on one line, used to read and book Google Calendar slots |
| `GOOGLE_CALENDAR_ID` | Recommended | The calendar that holds bookings. If you [split doctors/staff](google-sheet.md#doctors-and-staff-staff-tab), it becomes a combined calendar holding a copy of every booking for the owner (optional) |
| `CONFIG_SHEET_ID` | Optional | The Google Sheet with the shop data (see [Shop data](google-sheet.md)). Without it, the made-up clinic is used |
| `ANTHROPIC_API_KEY` | Optional | If set, Claude is called directly |
| `OPENAI_API_KEY` | Optional | If set, OpenAI is called directly |
| `AI_GATEWAY_API_KEY` | Optional | If set, calls go through AI Gateway (not needed on Vercel, which uses OIDC) |
| `AI_MODEL` | Optional | Changes the model within the selected provider |

> Without the Google values the agent still runs, but tells customers it cannot check the schedule yet. The LINE values are always required, or the app will not start (details below).

### Setting up `.env.local`

Create `.env.local` in the project root:

```bash
LINE_CHANNEL_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

| Variable | For | Where to find it |
|---|---|---|
| `LINE_CHANNEL_SECRET` | Checking that a webhook really comes from LINE | LINE Developers Console → channel → **Basic settings** → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Sending replies to customers | LINE Developers Console → channel → **Messaging API** → Channel access token (long-lived) → **Issue** |

> ⚠️ **Both values are always required**, even when you only test in the terminal without LINE. `agent/channels/line.ts` creates the LINE adapter when it loads, so without them the dev server will not start (eve compiles channels statically, so a channel cannot be turned off conditionally).

For `GOOGLE_SERVICE_ACCOUNT_KEY` and `GOOGLE_CALENDAR_ID`, see [Google Calendar setup](google-calendar.md).

### Model selection

`agent/agent.ts` picks the model from the API keys in the environment, in this order. The first match wins:

| Order | Condition | Provider | Default model | Example `AI_MODEL` |
|---|---|---|---|---|
| 1 | `ANTHROPIC_API_KEY` is set | Anthropic directly | `claude-sonnet-5` | `claude-haiku-5.5` |
| 2 | `OPENAI_API_KEY` is set | OpenAI directly | `gpt-5.6-luna` | `gpt-5.6-sol` |
| 3 | `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN` is set, or running on Vercel | AI Gateway | `openai/gpt-5.6-luna` | `anthropic/claude-sonnet-5` (needs the `provider/` prefix) |
| 4 | No key at all | ChatGPT subscription | `gpt-5.6-luna` | `gpt-5.6-luna-fast` |

- **Local testing (current setup):** no model key is needed in `.env.local`. Option 4, the ChatGPT subscription, is used (see `/login` in [Getting started](../README.md#getting-started)).
- **Production on Vercel:** without an Anthropic/OpenAI key, AI Gateway is used through OIDC. A ChatGPT subscription cannot be used on a server.
- After `npx eve link`, the pulled env may contain `VERCEL_OIDC_TOKEN`, which switches local runs from ChatGPT to the Gateway.
- Restart `npm run dev` after changing env values.
