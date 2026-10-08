/*
 * Prayer Times Break — Vencord userplugin
 * Copyright (c) 2026 mPhpMaster
 * SPDX-License-Identifier: MIT
 */

// The "City" setting: type a city, pick it from the results, and its
// coordinates fill latitude / longitude (which stay editable below).

import { PluginNative } from "@utils/types";
import { Button, Forms, React, TextInput, useState } from "@webpack/common";

import { tr } from "./core.generated";
import type { CityHit } from "./native";
import { settings } from "./settings";

const Native = VencordNative.pluginHelpers.PrayerTimesBreak as PluginNative<typeof import("./native")>;

export function CitySearch() {
    const store = settings.use(["cityLabel", "latitude", "longitude", "language"]);
    const L = tr(String(store.language || "ar"));
    const [query, setQuery] = useState("");
    const [hits, setHits] = useState<CityHit[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    async function search() {
        if (query.trim().length < 2) return;
        setBusy(true);
        setFailed(false);
        try {
            setHits(await Native.searchCity(query, String(store.language || "ar")));
        } catch {
            setFailed(true);
            setHits(null);
        } finally {
            setBusy(false);
        }
    }

    function pick(h: CityHit) {
        settings.store.latitude = Math.round(h.lat * 10000) / 10000;
        settings.store.longitude = Math.round(h.lon * 10000) / 10000;
        settings.store.cityLabel = h.name.split(",").slice(0, 2).join(",").trim();
        setHits(null);
        setQuery("");
    }

    const hasPlace = Number(store.latitude) !== 0 || Number(store.longitude) !== 0;

    return (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Forms.FormTitle tag="h3">{L.vencordCityLabel}</Forms.FormTitle>
            <Forms.FormText>
                {hasPlace
                    ? L.vencordCityCurrent(store.cityLabel || `${store.latitude}, ${store.longitude}`)
                    : L.vencordCityNone}
            </Forms.FormText>
            <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <TextInput
                        value={query}
                        placeholder={L.vencordCityPh}
                        onChange={(v: string) => setQuery(v)}
                        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") search(); }}
                    />
                </div>
                <Button disabled={busy || query.trim().length < 2} onClick={search}>
                    {L.vencordCityBtn}
                </Button>
            </div>
            {failed && <Forms.FormText style={{ color: "var(--text-danger)" }}>{L.vencordCityFail}</Forms.FormText>}
            {hits && hits.length === 0 && <Forms.FormText>{L.vencordCityEmpty}</Forms.FormText>}
            {hits && hits.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {hits.map(h => (
                        <Button
                            key={`${h.lat},${h.lon}`}
                            color={Button.Colors.PRIMARY}
                            size={Button.Sizes.SMALL}
                            style={{ justifyContent: "flex-start", textAlign: "start" }}
                            onClick={() => pick(h)}
                        >
                            {h.name}
                        </Button>
                    ))}
                </div>
            )}
        </section>
    );
}
