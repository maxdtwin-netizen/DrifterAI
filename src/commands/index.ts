import { adminCommand } from "./admin.js";
import { aiTipNowCommand } from "./ai-tip-now.js";
import { commodityCommand } from "./commodity.js";
import { contractCommand } from "./contract.js";
import { fleetCommand } from "./fleet.js";
import { helpCommand } from "./help.js";
import { locationCommand } from "./location.js";
import { miningCommand } from "./mining.js";
import { missionCommand } from "./mission.js";
import { newsCommand } from "./news.js";
import { orgCommand } from "./org.js";
import { postNewsNowCommand } from "./post-news-now.js";
import { profileCommand } from "./profile.js";
import { setupCheckCommand } from "./setup-check.js";
import { setupAiChatCommand } from "./setup-ai-chat.js";
import { setupChannelsCommand } from "./setup-channels.js";
import { setupRolesCommand } from "./setup-roles.js";
import { shipCommand } from "./ship.js";
import { statusCommand } from "./status.js";
import { tradeCommand } from "./trade.js";
import type { BotCommand } from "./types.js";
import { versionCommand } from "./version.js";
import { verifyCommand } from "./verify.js";

export const commands: BotCommand[] = [
  shipCommand,
  statusCommand,
  versionCommand,
  commodityCommand,
  tradeCommand,
  miningCommand,
  locationCommand,
  orgCommand,
  profileCommand,
  newsCommand,
  postNewsNowCommand,
  aiTipNowCommand,
  verifyCommand,
  setupRolesCommand,
  setupAiChatCommand,
  setupChannelsCommand,
  adminCommand,
  contractCommand,
  missionCommand,
  fleetCommand,
  setupCheckCommand,
  helpCommand
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
