// main.mjs — run the game API: `DB_KIND=... DATABASE_URL=... PORT=8787 npm start`.
import http from "node:http";
import { createApp } from "./app.mjs";
import { createStore } from "./stores/index.mjs";

const store = await createStore();
if (process.env.MIGRATE_ON_START === "1") await store.migrate();
const port = Number(process.env.PORT || 8787);
http.createServer(createApp(store)).listen(port, () => {
  console.log(`game API on :${port} (store: ${store.kind})`);
});
