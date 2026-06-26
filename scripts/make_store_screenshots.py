"""Render the Chrome Web Store screenshots end-to-end with headless Chrome.

For each language this script:
  1. Builds a throwaway harness from the real popup.html / welcome.html, with a
     mocked `chrome`/`fetch` and a frozen clock injected before the page scripts,
     so the UI paints real prayer data deterministically (no extension needed).
  2. Restyles the page into a 1280x800 "store stage": the dark-teal Midnight
     Emerald backdrop with a soft teal aura, and the popup/wizard floated in the
     centre as a glowing card (the glow is a CSS box-shadow — a real blur, not a
     hard border). `overflow:hidden` + --hide-scrollbars means no scrollbar.
  3. Screenshots it with headless Chrome at devicePixelRatio 2, then downscales
     to 1280x800 with Lanczos for crisp text.

Run:  python scripts/make_store_screenshots.py
Output: screenshots/<lang>.png (popup) and screenshots/welcome-<lang>.png
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "screenshots"
HARNESS = REPO / "_store_harness.html"  # transient; lives in repo root so the
#                                         page's relative asset URLs still resolve
CANVAS = (1280, 800)
DPR = 2

LANGS = ["en", "de", "ar", "ur", "hi", "id", "fr", "es"]
ARABIC_DIGIT_LANGS = {"ar", "ur"}  # show native Arabic-Indic numerals

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    str(Path.home() / r"AppData\Local\Google\Chrome\Application\chrome.exe"),
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


def find_chrome() -> str:
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    found = shutil.which("chrome") or shutil.which("google-chrome")
    if found:
        return found
    raise SystemExit("Could not find Chrome — set CHROME_CANDIDATES.")


# A fixed Friday afternoon in Riyadh: next prayer is Maghrib, countdown 03:18:42.
MOCK = r"""
<script>
(function(){
  var LANG="__LANG__", ARABIC_DIGITS=__ARABIC__;
  var _D=Date, FIXED=new _D(2026,5,26,15,26,18,0).getTime();
  function D(){ if(arguments.length===0) return new _D(FIXED);
    return new (Function.prototype.bind.apply(_D,[null].concat([].slice.call(arguments)))); }
  D.prototype=_D.prototype; D.now=function(){return FIXED;}; D.parse=_D.parse; D.UTC=_D.UTC;
  window.Date=D;
  var store={ lang:LANG, theme:"midnight-emerald", arabicDigits:ARABIC_DIGITS,
    location:{mode:"city", city:"Riyadh", country:"Saudi Arabia", method:4} };
  function get(keys){
    if(keys==null) return Object.assign({},store);
    if(typeof keys==="string") return (keys in store)?(function(){var o={};o[keys]=store[keys];return o;})():{};
    if(Array.isArray(keys)){var o={};keys.forEach(function(k){if(k in store)o[k]=store[k];});return o;}
    var o=Object.assign({},keys); for(var k in keys){ if(k in store) o[k]=store[k]; } return o;
  }
  window.chrome={ storage:{ local:{
    get:function(keys){return Promise.resolve(get(keys));},
    set:function(obj){Object.assign(store,obj);return Promise.resolve();},
    remove:function(k){[].concat(k).forEach(function(x){delete store[x];});return Promise.resolve();},
    clear:function(){for(var k in store)delete store[k];return Promise.resolve();}
  }}, tabs:{ getCurrent:function(cb){cb&&cb(null);}, remove:function(){} },
  runtime:{ sendMessage:function(){return Promise.resolve({ok:true});}, lastError:null, onMessage:{addListener:function(){}} } };
  var RESP={ code:200, status:"OK", data:{
    timings:{Fajr:"03:34",Sunrise:"05:06",Dhuhr:"11:56",Asr:"15:17",Maghrib:"18:45",Isha:"20:15",Imsak:"03:24",Midnight:"00:09"},
    date:{ readable:"26 Jun 2026", gregorian:{date:"26-06-2026", weekday:{en:"Friday"}, month:{number:6,en:"June"}, year:"2026"},
      hijri:{date:"11-01-1448", day:"11", month:{number:1,en:"Muḥarram",ar:"مُحَرَّم"}, year:"1448", designation:{abbreviated:"AH"} } } } };
  window.fetch=function(url){ var u=String(url);
    if(u.indexOf("aladhan")>=0) return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve(RESP);}});
    if(u.indexOf("countriesnow")>=0) return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve({error:false,data:["Riyadh","Jeddah","Mecca","Medina","Dammam","Khobar","Tabuk","Abha"]});}});
    return Promise.reject(new Error("blocked")); };
  document.addEventListener("DOMContentLoaded",function(){
    var f=document.getElementById("settings-frame"); if(f&&f.parentNode) f.remove();
  });
})();
</script>
"""

STAGE_COMMON = """
  html,body{ margin:0; padding:0; width:1280px; height:800px; overflow:hidden; }
  body{ display:flex; align-items:center; justify-content:center;
    background:
      radial-gradient(56% 52% at 50% 43%, rgba(45,212,191,.22), rgba(45,212,191,.05) 46%, transparent 72%),
      radial-gradient(130% 100% at 50% 52%, rgba(8,42,40,.55), transparent 70%),
      linear-gradient(168deg, #0a1c20 0%, #051215 56%, #02090b 100%) !important;
    background-attachment: initial !important; }
  .orb{ display:none !important; }
"""

STAGE_POPUP = """
  #settings-view{ display:none !important; }
  #main-view{
    width:340px; box-sizing:border-box; padding:18px 16px 16px;
    background: var(--gradient-bg);
    border-radius:30px;
    box-shadow: 0 30px 72px -24px rgba(0,0,0,.85), 0 0 92px -10px rgba(45,212,191,.45);
    transform-origin:center center; }
"""

STAGE_WELCOME = """
  #settings-frame{ display:none !important; }
  .card{
    margin:0 !important; border-radius:28px;
    box-shadow: 0 30px 72px -24px rgba(0,0,0,.85), 0 0 92px -10px rgba(45,212,191,.45);
    transform-origin:center center; }
"""

FIT = """
<script>
(function(){
  var SEL="__SEL__", MARGIN=__MARGIN__;
  function fit(){
    var c=document.querySelector(SEL); if(!c) return;
    c.style.transform="none";
    var h=c.getBoundingClientRect().height, maxH=800-2*MARGIN;
    var s=Math.min(1, maxH/h);
    c.style.transform="scale("+s.toFixed(4)+")";
  }
  if(document.fonts&&document.fonts.ready){ document.fonts.ready.then(function(){ setTimeout(fit,150); }); }
  setTimeout(fit,500); setTimeout(fit,1500);
})();
</script>
"""

# Per-kind: (source page, fit selector, vertical margin px reserved for the glow)
KINDS = {
    "popup":   {"src": "popup.html",   "stage": STAGE_POPUP,   "sel": "#main-view", "margin": 52},
    "welcome": {"src": "welcome.html", "stage": STAGE_WELCOME, "sel": ".card",      "margin": 58},
}


def build_harness(kind: str, lang: str) -> None:
    cfg = KINDS[kind]
    html = (REPO / cfg["src"]).read_text(encoding="utf-8")

    mock = MOCK.replace("__LANG__", lang).replace(
        "__ARABIC__", "true" if lang in ARABIC_DIGIT_LANGS else "false"
    )
    fit = FIT.replace("__SEL__", cfg["sel"]).replace("__MARGIN__", str(cfg["margin"]))
    style = f"<style>{STAGE_COMMON}{cfg['stage']}</style>"

    html = html.replace("<body>", "<body>\n" + mock, 1)
    html = html.replace("</head>", style + "\n</head>", 1)
    html = html.replace("</body>", fit + "\n</body>", 1)
    HARNESS.write_text(html, encoding="utf-8")


def capture(chrome: str, profile: str, kind: str, lang: str) -> Image.Image:
    build_harness(kind, lang)
    shot = Path(tempfile.gettempdir()) / f"_store_{kind}_{lang}.png"
    if shot.exists():
        shot.unlink()
    cmd = [
        chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        f"--user-data-dir={profile}",
        f"--force-device-scale-factor={DPR}",
        f"--window-size={CANVAS[0]},{CANVAS[1]}",
        "--virtual-time-budget=4000",
        "--run-all-compositor-stages-before-draw",
        f"--screenshot={shot}",
        HARNESS.as_uri(),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    img = Image.open(shot).convert("RGB")
    if img.size != CANVAS:
        img = img.resize(CANVAS, Image.Resampling.LANCZOS)
    shot.unlink(missing_ok=True)
    return img


def main() -> None:
    chrome = find_chrome()
    OUT.mkdir(parents=True, exist_ok=True)
    profile = tempfile.mkdtemp(prefix="store-shot-profile-")
    try:
        for lang in LANGS:
            popup = capture(chrome, profile, "popup", lang)
            popup.save(OUT / f"{lang}.png", "PNG", optimize=True)
            print(f"{lang}.png")
            welcome = capture(chrome, profile, "welcome", lang)
            welcome.save(OUT / f"welcome-{lang}.png", "PNG", optimize=True)
            print(f"welcome-{lang}.png")
    finally:
        HARNESS.unlink(missing_ok=True)
        shutil.rmtree(profile, ignore_errors=True)
    print("done")


if __name__ == "__main__":
    main()
