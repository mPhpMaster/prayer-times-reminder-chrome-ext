/*
 * Prayer Times Break — Vencord userplugin
 * Copyright (c) 2026 mPhpMaster
 * SPDX-License-Identifier: MIT
 */

// Discord shell of Prayer Times Reminder (Prayer Times Break). Assembled by
// `node tools/sync-core.mjs vencord` into a userplugin folder together with
// core.generated.js (the shared core/ as an ES module).

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import definePlugin from "@utils/types";

import { tr } from "./core.generated";
import { start, stop, todayReport } from "./runtime";
import { settings } from "./settings";

const EN = tr("en");

export default definePlugin({
    name: "PrayerTimesBreak",
    description: EN.vencordDesc,
    tags: ["Utility", "Notifications", "Commands"],
    authors: [{ name: "mPhpMaster", id: 0n }],
    settings,

    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "prayertimes",
            description: EN.vencordCmdDesc,
            execute: (_args, ctx) => {
                let content: string;
                try {
                    content = todayReport();
                } catch (e) {
                    content = tr(String(settings.store.language || "ar")).errGeneric;
                    console.error("[PrayerTimesBreak] /prayertimes failed", e);
                }
                sendBotMessage(ctx.channel.id, { content });
            }
        }
    ],

    start,
    stop
});
