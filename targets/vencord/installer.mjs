#!/usr/bin/env node
// Prayer Times Break — Discord (Vencord) plugin setup, shared by every OS.
//
// install.cmd / install.ps1 / install.sh make sure Git, Node.js 22+ and pnpm
// exist, then run this file. It finds Discord and the Vencord it loads, then:
//   - plugin missing   -> installs it (and builds + injects Vencord from source
//                         first when there is none, or only the official build);
//   - plugin present   -> asks: update it, remove it, or quit.
// Discord is closed while Vencord rebuilds and opened again at the end.
//
//   node targets/vencord/installer.mjs [--install|--update|--remove|--status]
//                                       [--yes] [--no-restart] [--vencord-dir <path>] [--ar|--en]

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const PLUGIN_FOLDER = "prayerTimesBreak"; // src/userplugins/<folder>
const PLUGIN_NAME = "PrayerTimesBreak"; // its key in Vencord's settings.json
const VENCORD_GIT = "https://github.com/Vendicated/Vencord.git";
const WIN = process.platform === "win32";
const MAC = process.platform === "darwin";

// ---- arguments ---------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
function option(name) {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}
const ACTION = ["--install", "--update", "--remove", "--status"].find(flag)?.slice(2) || null;
const YES = flag("--yes") || flag("-y");
const RESTART = !flag("--no-restart"); // --no-restart: leave Discord running; restart it yourself

// ---- messages (English / Arabic) ----------------------------------------------

const systemLocale = process.env.PTB_LANG || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || "";
const AR = flag("--ar") || (!flag("--en") && /^ar/i.test(systemLocale));

const T = {
    en: {
        title: "Prayer Times Break — Discord plugin setup",
        noDiscord: "Discord isn't installed (or wasn't found). Install it from https://discord.com/download and run this again.",
        discordAt: (p) => `Discord: ${p}`,
        vencordAt: (p) => `Vencord (source): ${p}`,
        vencordOfficial: "Vencord is installed from the official installer. Plugins like this one need Vencord built from source, so a source build will replace it (your Vencord settings stay).",
        vencordNone: "Vencord isn't installed. It will be downloaded, built and added to Discord.",
        pluginOn: "The plugin is installed.",
        pluginOff: "The plugin isn't installed.",
        menu: "What do you want to do?\n  1) Update the plugin to the latest version\n  2) Remove the plugin\n  3) Quit\nChoose 1, 2 or 3: ",
        askInstall: "Install the plugin now? [Y/n] ",
        askDir: (d) => `Where should Vencord be downloaded? Press Enter for ${d}\n> `,
        dirTaken: (d) => `${d} already exists and isn't a Vencord folder. Choose another folder.`,
        askUninstallVencord: "Also remove Vencord from Discord (back to normal Discord)? [y/N] ",
        bye: "Nothing changed.",
        step: (n, s) => `\n[${n}] ${s}`,
        sPlugin: "Preparing the plugin files",
        sClone: "Downloading Vencord",
        sDeps: "Installing Vencord's packages (this takes a minute)",
        sCopy: "Copying the plugin into Vencord",
        sClose: "Closing Discord",
        sBuild: "Building Vencord",
        sInject: "Adding Vencord to Discord",
        sSettings: "Turning the plugin on",
        sRemove: "Removing the plugin",
        sUninject: "Removing Vencord from Discord",
        sOpen: "Opening Discord",
        failed: (c) => `Failed: ${c}`,
        doneInstall: "Done! In Discord: User Settings → Vencord → Plugins → PrayerTimesBreak (gear icon) to choose your city.\nType /prayertimes-test in any chat to try the lock now.",
        doneRemove: "Done. The plugin was removed.",
        injectHint: "If the installer asks which Discord to patch, choose your Discord (usually Stable).",
        restartYourself: "Restart Discord (right-click its tray icon → Quit Discord, then open it) to load the change."
    },
    ar: {
        title: "استراحة مواقيت الصلاة — إعداد إضافة ديسكورد",
        noDiscord: "ديسكورد غير مثبّت (أو لم يُعثر عليه). ثبّته من https://discord.com/download ثم شغّل هذا مرة أخرى.",
        discordAt: (p) => `ديسكورد: ${p}`,
        vencordAt: (p) => `Vencord (من المصدر): ${p}`,
        vencordOfficial: "Vencord مثبّت بالمثبّت الرسمي. الإضافات مثل هذه تحتاج Vencord مبنيًا من المصدر، لذلك ستحلّ نسخة مبنية من المصدر مكانه (وتبقى إعداداتك).",
        vencordNone: "Vencord غير مثبّت. سيتم تنزيله وبناؤه وإضافته إلى ديسكورد.",
        pluginOn: "الإضافة مثبّتة.",
        pluginOff: "الإضافة غير مثبّتة.",
        menu: "ماذا تريد أن تفعل؟\n  1) تحديث الإضافة إلى آخر إصدار\n  2) حذف الإضافة\n  3) خروج\nاختر 1 أو 2 أو 3: ",
        askInstall: "تثبيت الإضافة الآن؟ [Y/n] ",
        askDir: (d) => `أين يُنزَّل Vencord؟ اضغط Enter لاختيار ${d}\n> `,
        dirTaken: (d) => `المجلد ${d} موجود وليس مجلد Vencord. اختر مجلدًا آخر.`,
        askUninstallVencord: "هل تريد أيضًا إزالة Vencord من ديسكورد (والعودة لديسكورد العادي)؟ [y/N] ",
        bye: "لم يتغيّر شيء.",
        step: (n, s) => `\n[${n}] ${s}`,
        sPlugin: "تجهيز ملفات الإضافة",
        sClone: "تنزيل Vencord",
        sDeps: "تثبيت حزم Vencord (يستغرق دقيقة)",
        sCopy: "نسخ الإضافة إلى Vencord",
        sClose: "إغلاق ديسكورد",
        sBuild: "بناء Vencord",
        sInject: "إضافة Vencord إلى ديسكورد",
        sSettings: "تفعيل الإضافة",
        sRemove: "حذف الإضافة",
        sUninject: "إزالة Vencord من ديسكورد",
        sOpen: "فتح ديسكورد",
        failed: (c) => `فشل: ${c}`,
        doneInstall: "تم! في ديسكورد: إعدادات المستخدم ← Vencord ← Plugins ← PrayerTimesBreak (أيقونة الترس) لاختيار مدينتك.\nاكتب /prayertimes-test في أي محادثة لتجربة القفل الآن.",
        doneRemove: "تم. حُذفت الإضافة.",
        injectHint: "إذا سألك المثبّت أي ديسكورد يعدّل، اختر ديسكورد الخاص بك (غالبًا Stable).",
        restartYourself: "أعد تشغيل ديسكورد (زر أيمن على أيقونته بجانب الساعة ← Quit Discord ثم افتحه) ليظهر التغيير."
    }
};
const L = AR ? T.ar : T.en;

// ---- helpers -----------------------------------------------------------------

let rl = null;
async function ask(question) {
    rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });
    return (await rl.question(question)).trim();
}

let stepNo = 0;
const step = (s) => console.log(L.step(++stepNo, s));

// Runs a command with its output shown; exits with a message when it fails.
// pnpm is a .cmd script on Windows, which needs a shell (its args never hold spaces).
function run(cmd, args, cwd, { shell = false, allowFail = false } = {}) {
    const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell });
    if (res.status !== 0 && !allowFail) {
        console.error(L.failed([cmd, ...args].join(" ")));
        process.exit(1);
    }
    return res.status === 0;
}
const pnpm = (args, cwd) => run(WIN ? "pnpm.cmd" : "pnpm", args, cwd, { shell: WIN });

const isVencordSource = (dir) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
        return pkg.name === "vencord" && fs.existsSync(path.join(dir, "src"));
    } catch {
        return false;
    }
};

// ---- Discord -----------------------------------------------------------------

// Every Discord install found: { label, resources, launch() }.
function findDiscords() {
    const found = [];
    const add = (label, resources, launch) => {
        if (fs.existsSync(path.join(resources, "app.asar")) || fs.existsSync(path.join(resources, "_app.asar")))
            found.push({ label, resources, launch });
    };
    const home = os.homedir();
    if (WIN) {
        const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
        for (const name of ["Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment"]) {
            const base = path.join(local, name);
            if (!fs.existsSync(base)) continue;
            const apps = fs.readdirSync(base).filter((d) => /^app-[\d.]+$/.test(d))
                .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
            if (!apps.length) continue;
            add(name, path.join(base, apps[0], "resources"), () =>
                spawn(path.join(base, "Update.exe"), ["--processStart", `${name}.exe`], { detached: true, stdio: "ignore" }).unref());
        }
    } else if (MAC) {
        for (const name of ["Discord", "Discord PTB", "Discord Canary", "Discord Development"]) {
            for (const root of ["/Applications", path.join(home, "Applications")]) {
                add(name, path.join(root, `${name}.app`, "Contents", "Resources"), () =>
                    spawn("open", ["-a", name], { detached: true, stdio: "ignore" }).unref());
            }
        }
    } else {
        const dirs = [
            "/usr/share/discord", "/usr/share/discord-ptb", "/usr/share/discord-canary",
            "/usr/lib/discord", "/usr/lib64/discord", "/opt/discord", "/opt/Discord", "/opt/DiscordPTB", "/opt/DiscordCanary",
            path.join(home, ".local/share/discord"), path.join(home, ".local/share/Discord"),
            "/var/lib/flatpak/app/com.discordapp.Discord/current/active/files/discord",
            path.join(home, ".local/share/flatpak/app/com.discordapp.Discord/current/active/files/discord"),
            "/snap/discord/current/usr/share/discord"
        ];
        for (const dir of dirs) {
            const flatpak = dir.includes("flatpak");
            add(path.basename(dir), path.join(dir, "resources"), () => {
                const [cmd, args] = flatpak ? ["flatpak", ["run", "com.discordapp.Discord"]] : ["discord", []];
                try { spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref(); } catch { /* opened by hand */ }
            });
        }
    }
    return found;
}

// The Vencord folder a patched Discord loads: its app.asar is a tiny shim
// containing require("<vencord>/dist/patcher.js").
function vencordDirOf(discord) {
    try {
        const file = path.join(discord.resources, "app.asar");
        if (fs.statSync(file).size > 64 * 1024) return null; // Discord's own app, not patched
        const m = /require\(("(?:[^"\\]|\\.)*patcher\.js")\)/.exec(fs.readFileSync(file, "latin1"));
        return m ? path.dirname(path.dirname(JSON.parse(m[1]))) : null;
    } catch {
        return null;
    }
}

function closeDiscord() {
    if (!RESTART) return;
    step(L.sClose);
    if (WIN) {
        for (const exe of ["Discord.exe", "DiscordPTB.exe", "DiscordCanary.exe", "DiscordDevelopment.exe"])
            spawnSync("taskkill", ["/IM", exe, "/F"], { stdio: "ignore" });
    } else {
        for (const name of ["Discord", "discord", "Discord PTB", "DiscordPTB", "Discord Canary", "DiscordCanary"])
            spawnSync("pkill", ["-x", name], { stdio: "ignore" });
    }
    spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 2500)"]); // let it exit and release files
}

function openDiscord(target) {
    if (!RESTART) {
        console.log(`\n${L.restartYourself}`);
        return;
    }
    step(L.sOpen);
    target.launch();
}

// ---- Vencord settings (enable / forget the plugin) -------------------------------

function settingsFile() {
    const home = os.homedir();
    const base = WIN ? (process.env.APPDATA || path.join(home, "AppData", "Roaming"))
        : MAC ? path.join(home, "Library", "Application Support")
            : (process.env.XDG_CONFIG_HOME || path.join(home, ".config"));
    return path.join(base, "Vencord", "settings", "settings.json");
}

function setPluginEnabled(enabled) {
    const file = settingsFile();
    let data = {};
    try {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        if (!enabled) return;
    }
    data.plugins ??= {};
    if (enabled) data.plugins[PLUGIN_NAME] = { ...(data.plugins[PLUGIN_NAME] || {}), enabled: true };
    else delete data.plugins[PLUGIN_NAME];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

// ---- main ----------------------------------------------------------------------

async function main() {
    console.log(`\n${L.title}\n${"=".repeat(L.title.length)}`);

    const discords = findDiscords();
    if (!discords.length) {
        console.log(L.noDiscord);
        process.exit(1);
    }
    const linked = discords.map((d) => ({ ...d, vencord: vencordDirOf(d) }));
    for (const d of linked) console.log(L.discordAt(d.resources));

    // The Vencord to use: --vencord-dir, $VENCORD_DIR, or the source build Discord loads.
    let vencordDir = option("--vencord-dir") || process.env.VENCORD_DIR
        || linked.map((d) => d.vencord).find((dir) => dir && isVencordSource(dir)) || null;
    if (vencordDir) vencordDir = path.resolve(vencordDir);
    const haveSource = !!vencordDir && isVencordSource(vencordDir);
    const pluginDir = haveSource ? path.join(vencordDir, "src", "userplugins", PLUGIN_FOLDER) : null;
    const installed = !!pluginDir && fs.existsSync(pluginDir);

    if (haveSource) console.log(L.vencordAt(vencordDir));
    else if (linked.some((d) => d.vencord)) console.log(L.vencordOfficial);
    else console.log(L.vencordNone);
    console.log(installed ? L.pluginOn : L.pluginOff);
    if (ACTION === "status") return;

    let action = ACTION;
    if (installed && (!action || action === "install")) {
        if (!action) {
            const pick = await ask(`\n${L.menu}`);
            action = pick === "1" ? "update" : pick === "2" ? "remove" : null;
        } else {
            action = "update";
        }
    } else if (!installed && action !== "remove") {
        if (!YES && !action && !/^(y|yes|نعم|ن|)$/i.test(await ask(`\n${L.askInstall}`))) action = null;
        else action = "install";
    } else if (!installed && action === "remove") {
        action = null; // nothing to remove
    }
    if (!action) {
        console.log(L.bye);
        return;
    }

    const target = linked.find((d) => d.vencord && vencordDir && path.resolve(d.vencord) === vencordDir) || linked[0];

    if (action === "remove") {
        closeDiscord();
        step(L.sRemove);
        fs.rmSync(pluginDir, { recursive: true, force: true });
        setPluginEnabled(false);
        step(L.sBuild);
        pnpm(["build"], vencordDir);
        if (!YES && /^(y|yes|نعم|ن)$/i.test(await ask(`\n${L.askUninstallVencord}`))) {
            step(L.sUninject);
            run(process.execPath, ["scripts/runInstaller.mjs", "--", "--uninstall", "--branch", "auto"], vencordDir, { allowFail: true });
        }
        openDiscord(target);
        console.log(`\n${L.doneRemove}`);
        return;
    }

    // install / update
    step(L.sPlugin);
    run(process.execPath, [path.join(REPO, "tools", "sync-core.mjs"), "vencord"], REPO);
    const built = path.join(REPO, "targets", "vencord", "build", PLUGIN_FOLDER);

    if (!haveSource) {
        const fallback = path.join(os.homedir(), "Vencord");
        for (;;) {
            vencordDir = path.resolve(YES ? fallback : (await ask(`\n${L.askDir(fallback)}`)) || fallback);
            if (isVencordSource(vencordDir) || !fs.existsSync(vencordDir) || !fs.readdirSync(vencordDir).length) break;
            console.log(L.dirTaken(vencordDir));
            if (YES) process.exit(1);
        }
        if (!isVencordSource(vencordDir)) {
            step(L.sClone);
            run("git", ["clone", "--depth", "1", VENCORD_GIT, vencordDir], process.cwd());
        }
    }
    if (!fs.existsSync(path.join(vencordDir, "node_modules"))) {
        step(L.sDeps);
        pnpm(["install", "--frozen-lockfile"], vencordDir);
    }

    step(L.sCopy);
    const dest = path.join(vencordDir, "src", "userplugins", PLUGIN_FOLDER);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(built, dest, { recursive: true });

    closeDiscord();
    step(L.sBuild);
    pnpm(["build"], vencordDir);

    // Point Discord at this build unless it already loads it.
    const loadsThis = linked.some((d) => d.vencord && path.resolve(d.vencord) === path.resolve(vencordDir));
    if (!loadsThis) {
        step(L.sInject);
        console.log(L.injectHint);
        run(process.execPath, ["scripts/runInstaller.mjs", "--", "--install", "--branch", "auto"], vencordDir);
    }

    step(L.sSettings);
    setPluginEnabled(true);

    openDiscord(target);
    console.log(`\n${L.doneInstall}`);
}

main()
    .catch((e) => {
        console.error(e?.message || e);
        process.exitCode = 1;
    })
    .finally(() => rl?.close());
