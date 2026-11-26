import { EventEmitter } from "node:events";
import { createClient } from "redis";

// Live event bus for the Server-Sent Events feed (/api/live).
//
//  - REDIS_URL unset  -> in-memory bus. Fine for ONE API process (tests,
//    local `npm start`), but events never leave the process.
//  - REDIS_URL set    -> Redis pub/sub. Every API replica publishes to and
//    subscribes from the same channel, so a team registering on replica A
//    shows up in the feed of a browser connected to replica B. This is what
//    makes the API horizontally scalable (docker compose --scale, Kubernetes
//    replicas / HPA).
const CHANNEL = "gridlock:events";
const RECENT_KEY = "gridlock:recent";
const MAX_RECENT = 20;

const bus = new EventEmitter();
bus.setMaxListeners(1000); // one per connected SSE client

const localRecent = [];
function rememberLocal(event) {
  localRecent.push(event);
  if (localRecent.length > MAX_RECENT) localRecent.shift();
}

let pub = null;
let sub = null;

if (process.env.REDIS_URL) {
  pub = createClient({ url: process.env.REDIS_URL });
  sub = pub.duplicate();
  // A Redis outage must not crash the API; node-redis reconnects by itself.
  pub.on("error", (err) => console.error("Redis (pub) error:", err.message));
  sub.on("error", (err) => console.error("Redis (sub) error:", err.message));

  pub.connect().catch((err) => console.error("Redis (pub) connect failed:", err.message));
  sub
    .connect()
    .then(() =>
      sub.subscribe(CHANNEL, (message) => {
        try {
          bus.emit("event", JSON.parse(message));
        } catch {
          /* ignore malformed message */
        }
      }),
    )
    .catch((err) => console.error("Redis (sub) connect failed:", err.message));
}

export function getRedisClient() {
  return pub && pub.isReady ? pub : null;
}

export function liveBackend() {
  return pub ? "redis" : "memory";
}

export function emit(event) {
  if (!pub) {
    rememberLocal(event);
    bus.emit("event", event);
    return;
  }
  const payload = JSON.stringify(event);
  pub
    .multi()
    .lPush(RECENT_KEY, payload)
    .lTrim(RECENT_KEY, 0, MAX_RECENT - 1)
    .publish(CHANNEL, payload)
    .exec()
    .catch((err) => {
      // Redis unreachable: degrade to this replica only rather than lose the event.
      console.error("Redis publish failed, delivering locally:", err.message);
      rememberLocal(event);
      bus.emit("event", event);
    });
}

export async function getRecent() {
  if (!pub) return localRecent.slice();
  try {
    const items = await pub.lRange(RECENT_KEY, 0, MAX_RECENT - 1);
    return items.reverse().map((i) => JSON.parse(i)); // oldest first
  } catch {
    return localRecent.slice();
  }
}

export function subscribe(listener) {
  bus.on("event", listener);
  return () => bus.off("event", listener);
}

export async function closeLive() {
  await Promise.allSettled([pub?.quit(), sub?.quit()]);
}
