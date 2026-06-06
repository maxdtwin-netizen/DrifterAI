# DrifterAI v1.2.0 Patch Notes

## Summary
DrifterAI got a cleaner scheduler, a dedicated patch-notes flow, and a shorter wake call. The bot should be less noisy and easier to call during normal Discord chat.

## Changed
- DrifterAI now responds to `DAI` as a shortcut for `DrifterAI`.
- Patch updates now target `#drifterai-patch-notes` when available.
- Patch posts now include Star Citizen LIVE/PTU version fields when version data is available.
- Patch notes now check every hour and post only when patch/version info changes.
- Game status checks every hour and posts only when status changed from the last saved status.
- AI daily tips now post once per day in one random org channel instead of posting across every channel.
- Bot version is now `v1.2.0`.

## Admin
- Added `/admin set_patch_channel` so admins can save the current channel as the patch-notes channel.
- After deploying this update, run `npm.cmd run deploy-commands` once so Discord sees the new admin option.

## Notes
- No bot re-invite is needed.
- After pushing to GitHub, Railway should redeploy automatically.
- Verify Railway logs show `Ready as DrifterAI#9395. Contracts are open.`
