# DrifterAI v1.2.1 Patch Notes

## Summary
DrifterAI can now announce his own bot updates automatically after a deploy.

## Added
- DrifterAI checks for a matching bot patch-notes file on startup.
- Patch notes are read from the `outputs` folder.
- If a new bot version has not been posted before, DrifterAI posts it to `#drifterai-patch-notes`.
- DrifterAI remembers the last posted bot version so restarts do not spam the channel.

## Changed
- Bot version is now `v1.2.1`.

## How It Works
- Create a file like `outputs/DrifterAI-v1.2.1-patch-notes.md`.
- Update `package.json` version to match.
- Deploy the bot.
- DrifterAI posts the patch notes once after startup.

## Notes
- This is for DrifterAI bot updates, separate from Star Citizen patch notes.
- The Discord channel should be named `drifterai-patch-notes`, or set with `/admin set_patch_channel`.
