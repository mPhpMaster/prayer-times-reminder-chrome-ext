/*
 * Prayer Times Break — Vencord userplugin
 * Copyright (c) 2026 mPhpMaster
 * SPDX-License-Identifier: MIT
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import {
    DEFAULT_LOCK_MINUTES,
    DEFAULT_SETTINGS,
    DEFAULT_TASBIH_MINUTES,
    DEFAULT_TASBIH_POSITION,
    METHODS,
    SUPPORTED_LANGS,
    TASBIH_POSITIONS,
    tr
} from "./core.generated";
import { CitySearch } from "./citySearch";

// Settings UI text comes from the shared core i18n (English: Vencord's
// settings pages are English-only); the runtime text follows `language`.
const EN = tr("en");

// runtime.ts registers this so any setting change re-plans timers. Kept as a
// hook (not an import) to avoid a settings <-> runtime import cycle.
let changeHandler: () => void = () => { };
export function onSettingsChange(fn: () => void) {
    changeHandler = fn;
}
const onChange = () => changeHandler();

const inRange = (min: number, max: number) => (v: number) => Number.isFinite(Number(v)) && v >= min && v <= max;

export const settings = definePluginSettings({
    // Type a city and pick it: fills latitude / longitude below.
    city: {
        type: OptionType.COMPONENT,
        component: CitySearch
    },
    cityLabel: {
        type: OptionType.STRING,
        description: "",
        default: "",
        hidden: true,
        onChange
    },
    latitude: {
        type: OptionType.NUMBER,
        description: EN.vencordLatHint,
        default: 0,
        isValid: inRange(-90, 90),
        onChange
    },
    longitude: {
        type: OptionType.NUMBER,
        description: EN.vencordLonHint,
        default: 0,
        isValid: inRange(-180, 180),
        onChange
    },
    method: {
        type: OptionType.SELECT,
        description: EN.method,
        options: METHODS.map(m => ({ label: m.en, value: m.value, default: m.value === DEFAULT_SETTINGS.location.method })),
        onChange
    },
    language: {
        type: OptionType.SELECT,
        description: EN.settingsLangLabel,
        options: SUPPORTED_LANGS.map(l => ({ label: l.name, value: l.code, default: l.code === DEFAULT_SETTINGS.lang })),
        onChange
    },
    notify: {
        type: OptionType.BOOLEAN,
        description: EN.vencordNotifyLabel,
        default: true,
        onChange
    },
    lockEnabled: {
        type: OptionType.BOOLEAN,
        description: `${EN.vencordLockLabel}. ${EN.vencordLockHint}`,
        default: DEFAULT_SETTINGS.tabLockEnabled !== false,
        onChange
    },
    lockMinutes: {
        type: OptionType.NUMBER,
        description: EN.lockMinutesLabel,
        default: DEFAULT_LOCK_MINUTES,
        isValid: inRange(1, 120),
        onChange
    },
    allowUnlock: {
        type: OptionType.BOOLEAN,
        description: `${EN.allowUnlockLabel}. ${EN.allowUnlockHint}`,
        default: DEFAULT_SETTINGS.allowUnlock === true,
        onChange
    },
    sound: {
        type: OptionType.SELECT,
        description: `${EN.soundLabel} (${EN.vencordLockLabel})`,
        options: [
            { label: EN.soundBeep, value: "beep", default: true },
            { label: EN.soundNone, value: "none" }
        ],
        onChange
    },
    dhikrEnabled: {
        type: OptionType.BOOLEAN,
        description: EN.tasbihLabel,
        default: DEFAULT_SETTINGS.tasbihEnabled === true,
        onChange
    },
    dhikrMinutes: {
        type: OptionType.NUMBER,
        description: `${EN.tasbihLabel}: ${EN.tasbihMinutesLabel}`,
        default: DEFAULT_TASBIH_MINUTES,
        isValid: inRange(1, 120),
        onChange
    },
    dhikrPosition: {
        type: OptionType.SELECT,
        description: EN.tasbihPositionLabel,
        options: TASBIH_POSITIONS.map(p => ({ label: p.en, value: p.key, default: p.key === DEFAULT_TASBIH_POSITION })),
        onChange
    },
    theme: {
        type: OptionType.SELECT,
        description: EN.themeLabel,
        options: [
            { label: EN.themeMidnightEmerald, value: "midnight-emerald", default: true },
            { label: EN.themeClassic, value: "classic" }
        ],
        onChange
    }
});
