import { EventEmitter } from "node:events";

// ponytail: single-instance in-memory pub-sub. Fine for one Render free
// web service. If this ever runs as >1 instance, events won't cross
// processes — upgrade to Postgres LISTEN/NOTIFY or Redis pub-sub then.
const bus = new EventEmitter();
bus.setMaxListeners(1000); // one per connected SSE client

const recent = [];
const MAX_RECENT = 20;

export function emit(event) {
  recent.push(event);
  if (recent.length > MAX_RECENT) recent.shift();
  bus.emit("event", event);
}

export function getRecent() {
  return recent;
}

export function subscribe(listener) {
  bus.on("event", listener);
  return () => bus.off("event", listener);
}
