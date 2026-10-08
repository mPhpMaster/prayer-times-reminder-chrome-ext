/*
 * Prayer Times Break — Vencord userplugin
 * Copyright (c) 2026 mPhpMaster
 * SPDX-License-Identifier: MIT
 */

// Runs in Discord's main (Node) process: the city search in the settings asks
// OpenStreetMap's Nominatim, which Discord's page CSP would block. Only the
// typed city name is sent — never the device's location.

import { IpcMainInvokeEvent } from "electron";

export interface CityHit {
    name: string;
    lat: number;
    lon: number;
}

const UA = "PrayerTimesBreak-Vencord/1.0 (+https://github.com/mPhpMaster/prayer-times-reminder-chrome-ext)";

export async function searchCity(_: IpcMainInvokeEvent, query: string, lang: string): Promise<CityHit[]> {
    const q = String(query || "").trim().slice(0, 100);
    if (q.length < 2) return [];
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "6");
    url.searchParams.set("q", q);
    url.searchParams.set("accept-language", /^[a-z]{2}$/.test(lang) ? `${lang},en` : "en");
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const rows = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string; }>;
    return rows
        .map(r => ({ name: String(r.display_name || ""), lat: Number(r.lat), lon: Number(r.lon) }))
        .filter(r => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lon));
}
