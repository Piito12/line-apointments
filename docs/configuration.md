# Environment variables and model selection

[← Back to README](../README.md#english) · [ภาษาไทย](configuration.th.md)

Every value is a secret. **Never commit them.** For local runs, put them in `.env.local` (already ignored by git). For deployments, add them in Vercel → Project → **Settings → Environment Variables** (the Deploy button asks for LINE, Google, `CONFIG_SHEET_ID`, `AI_PROVIDER` and `AI_API_KEY` when it creates the project).

| Variable | Required | For |
|---|---|---|
| `LINE_CHANNEL_SECRET` | ✅ | Verifying LINE webhook signatures |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | Sending replies to customers |
| `GOOGLE_CLIENT_EMAIL` | Recommended | `client_email` from the service account's JSON key. Used with `GOOGLE_PRIVATE_KEY` to read and book Google Calendar slots and read the Sheet |
| `GOOGLE_PRIVATE_KEY` | Recommended | `private_key` from the same JSON key, from `-----BEGIN PRIVATE KEY-----` to the end |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Optional | Older form: the whole JSON key on one line, instead of the 2 values above |
| `GOOGLE_CALENDAR_ID` | Recommended | The calendar that holds bookings. If you [split doctors/staff](google-sheet.md#doctors-and-staff-staff-tab), it becomes a combined calendar holding a copy of every booking for the owner (optional) |
| `CONFIG_SHEET_ID` | Optional | The Google Sheet with the shop data (see [Shop data](google-sheet.md)). Empty or `demo` = the made-up clinic. The Deploy button pre-fills `demo`; replace it with your Sheet ID to use your own data |
| `AI_PROVIDER` | ✅ when deploying | The AI provider: `anthropic` · `openai` · `gateway` (the Deploy button pre-fills `anthropic`; you can change it) |
| `AI_API_KEY` | ✅ when deploying | The key for the provider in `AI_PROVIDER` |
| `ANTHROPIC_API_KEY` | Optional | Older name, used when `AI_PROVIDER` is not set: calls Claude directly |
| `OPENAI_API_KEY` | Optional | Older name, used when `AI_PROVIDER` is not set: calls OpenAI directly |
| `AI_GATEWAY_API_KEY` | Optional | Older name, used when `AI_PROVIDER` is not set: calls go through AI Gateway |
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

For `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` and `GOOGLE_CALENDAR_ID`, see [Google Calendar setup](google-calendar.md).

### Model selection

**Option 1: `AI_PROVIDER` + `AI_API_KEY`** (for deploys; the Deploy button requires both)

| `AI_PROVIDER` | `AI_API_KEY` | Default model | Example `AI_MODEL` |
|---|---|---|---|
| `anthropic` | An Anthropic key (`sk-ant-…`) | `claude-sonnet-5` | `claude-haiku-5.5` |
| `openai` | An OpenAI key | `gpt-5.6-luna` | `gpt-5.6-sol` |
| `gateway` | A Vercel AI Gateway key | `openai/gpt-5.6-luna` | `anthropic/claude-sonnet-5`, `google/…` (needs the `provider/` prefix) |

- `gateway` reaches many providers with one key: switch providers by changing `AI_MODEL`. Usage is billed through the Vercel account's AI Gateway.
- Any other `AI_PROVIDER` value fails the build with a message listing the valid values.

**Option 2: no `AI_PROVIDER`.** The model is picked from the keys you have. The first match wins:

| Order | Condition | Provider | Default model |
|---|---|---|---|
| 1 | `ANTHROPIC_API_KEY` is set | Anthropic directly | `claude-sonnet-5` |
| 2 | `OPENAI_API_KEY` is set | OpenAI directly | `gpt-5.6-luna` |
| 3 | `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN` is set, or running on Vercel | AI Gateway | `openai/gpt-5.6-luna` |
| 4 | No key at all | ChatGPT subscription | `gpt-5.6-luna` |

- **Local testing:** leave `AI_PROVIDER` empty and set no key to use a ChatGPT subscription (option 4; see `/login` in [Getting started](../README.md#getting-started)).
- A ChatGPT subscription cannot be used on a server.
- After `npx eve link`, the pulled env may contain `VERCEL_OIDC_TOKEN`, which switches local runs from ChatGPT to the Gateway.
- Restart `npm run dev` after changing env values, and Redeploy on Vercel.
