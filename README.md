# DrifterAI

Small practical Discord bot for the **Drifters** Star Citizen organization.

DrifterAI is an org assistant, not a roleplay-only toy. It handles verification, role selection, useful Star Citizen lookups, contracts, missions, fleet logs, and basic server setup.

## What It Uses

- Node.js 24+ + TypeScript
- discord.js v14
- Slash commands
- SQLite database at `data/drifterai.sqlite` using Node's built-in SQLite
- `.env` for secrets
- `config.json` for optional scheduled posts
- Public/community Star Citizen data sources only

## Required `.env`

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
STAR_CITIZEN_API_KEY=
UEX_API_KEY=
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

`STAR_CITIZEN_API_KEY` and `UEX_API_KEY` can be blank. The bot still runs and replies with clear API/config messages where those sources are unavailable.

`GROQ_API_KEY` is optional. If set, DrifterAI can post useful AI-generated daily tips. Without it, AI commands return `API key not configured`.

For web answers, use Groq plus a search provider. Add `BRAVE_SEARCH_API_KEY` or `TAVILY_API_KEY`; DrifterAI searches first, then Groq writes the Discord reply with sources. Set `WEB_SEARCH_PROVIDER=auto`, `brave`, or `tavily`.

## Discord Developer Portal

In your bot application:

1. Open **Bot**.
2. Enable **Server Members Intent**.
3. Reset/rotate your token if it was ever pasted into a public file.
4. Invite the bot with:

```text
bot
applications.commands
```

Recommended permissions:

```text
Manage Roles
Manage Channels
Send Messages
Embed Links
Read Message History
View Channels
Use Slash Commands
```

Put the DrifterAI bot role above any roles it should assign.

## Run Locally

```powershell
npm.cmd install
npm.cmd run deploy-commands
npm.cmd run dev
```

When it is online:

```text
Ready as DrifterAI#9395. Contracts are open.
```

## First Server Setup

Run these in Discord:

```text
/setup_channels
/setup_roles
/setup_ai_chat
/setup-check
```

`/setup_channels` creates useful categories and channels:

- INFO: `welcome`, `rules`, `announcements`, `role-select`, `org-info`, `ai-chat`
- STAR CITIZEN: `sc-news`, `game-status`, `patch-notes`, `ship-talk`, `loadouts`, `questions`
- ORG OPERATIONS: `contracts`, `missions`, `event-planning`, `looking-for-group`, `fleet-log`, `intel-drops`
- ECONOMY: `trade-routes`, `mining`, `salvage`, `cargo-prices`
- VOICE: mission, mining, trading, and FPS voice channels

`/setup_roles` creates practical roles and posts a button menu for gameplay roles:

- Miner
- Trader
- Salvager
- Medic
- Pilot
- FPS
- Cargo
- Bounty Hunter
- Industrial

You do **not** need to manually create all channels first. Let `/setup_channels` do it. You may still want to edit descriptions, reorder channels, and tighten permissions afterward.

## Commands

Org setup:

- `/setup_channels`
- `/setup_roles`
- `/setup_ai_chat`
- `/setup-check`
- `/admin config`
- `/admin set_news_channel`
- `/admin set_status_channel`
- `/admin set_contract_channel`
- `/admin set_verified_role`
- `/admin sync_commands`
- `/ai_tip_now`

Members and roles:

- `/verify rsi_handle`
- Role buttons from `/setup_roles`

Contracts:

- `/contract create`
- `/contract list`
- `/contract join contract_id`
- `/contract close contract_id`

Missions:

- `/mission create`
- `/mission list`
- `/mission join mission_id`

Fleet:

- `/fleet add ship_name`
- `/fleet list user`
- `/fleet remove ship_name`

Star Citizen intel:

- `/news`
- `/status`
- `/version`
- `/profile rsi_handle`
- `/org org_name_or_sid`
- `/ship ship_name`
- `/trade from to commodity`
- `/commodity commodity_name`
- `/location location_name`
- `/mining material`
- `/price commodity`
- `/route commodity start`

Help:

- `/help`

## Scheduled Posts

Edit `config.json`:

```json
{
  "autoNews": true,
  "autoStatus": true,
  "autoTradeTips": false,
  "autoAiTips": true
}
```

News uses the official RSI Comm-Link RSS feed:

```text
https://robertsspaceindustries.com/en/comm-link/rss
```

If `autoNews` is enabled and `/setup_channels` or `/admin set_news_channel` has saved a news channel, DrifterAI checks for a new Comm-Link shortly after startup and then every hour. It stores the last posted link in SQLite so it does not spam duplicates.

The MVP does not post fake status/trade data. If a stable API endpoint or key is not configured, those scheduled posts stay quiet.

AI tips use Groq's OpenAI-compatible Chat Completions API if `GROQ_API_KEY` is configured. DrifterAI checks once per hour and posts at most one AI tip per channel per day. The AI prompt tells the model not to invent live prices, outages, patch facts, or other live data.

## Free 24/7 Hosting

For free 24/7 hosting, use Oracle Cloud Free Tier with a small Ubuntu VM. Upload the project, run `npm install`, deploy commands, then use `pm2` to keep it running:

```bash
npm install
npm run build
npm run deploy-commands
npm install -g pm2
pm2 start dist/index.js --name drifterai
pm2 save
```

Your PC works too, but only while the terminal stays open.

## Notes

- The bot does not fetch private inventory, aUEC, ship location, mission state, or live server position.
- API results are cached.
- Missing API keys produce clear messages.
- Data footer: `Data from public/community sources; verify in-game.`
