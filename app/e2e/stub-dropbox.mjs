// In-memory stand-in for the Supabase drop-box RPCs (same contract as
// supabase/schema.sql), so e2e tests run without a live project.
import http from "node:http";

export function startStubDropbox(port = 0) {
  const trips = new Map(); // id -> {writeKey, readKey}
  const cards = new Map(); // `${trip}:${round}:${player}` -> row
  const completed = new Set(); // `${trip}:${round}`
  const tripState = new Map(); // id -> {state, updated_at}

  const server = http.createServer((req, res) => {
    const send = (code, body) => {
      res.writeHead(code, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    if (req.method === "OPTIONS") return send(204);
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      const args = data ? JSON.parse(data) : {};
      const fn = req.url?.split("/rpc/")[1];
      if (fn === "gts_register_trip") {
        if (!trips.has(args.p_trip)) trips.set(args.p_trip, { writeKey: args.p_write_key, readKey: args.p_read_key });
        return send(204);
      }
      const trip = trips.get(args.p_trip);
      if (fn === "gts_submit_card") {
        if (!trip || trip.writeKey !== args.p_key) return send(401, { message: "bad trip or key" });
        if (completed.has(`${args.p_trip}:${args.p_round}`)) return send(409, { message: "round completed" });
        cards.set(`${args.p_trip}:${args.p_round}:${args.p_player}`, {
          round: args.p_round, player: args.p_player, name: args.p_name,
          scores: args.p_scores, done: args.p_done, updated_at: new Date().toISOString(),
        });
        return send(204);
      }
      if (fn === "gts_organiser_submit_card") {
        if (!trip || trip.readKey !== args.p_key) return send(401, { message: "bad trip or key" });
        cards.set(`${args.p_trip}:${args.p_round}:${args.p_player}`, {
          round: args.p_round, player: args.p_player, name: args.p_name,
          scores: args.p_scores, done: args.p_done, updated_at: new Date().toISOString(),
        });
        return send(204);
      }
      if (fn === "gts_fetch_own_card") {
        if (!trip || trip.writeKey !== args.p_key) return send(401, { message: "bad trip or key" });
        const row = cards.get(`${args.p_trip}:${args.p_round}:${args.p_player}`);
        return send(200, row ? [{ scores: row.scores, done: row.done, updated_at: row.updated_at }] : []);
      }
      if (fn === "gts_fetch_cards") {
        if (!trip || trip.readKey !== args.p_key) return send(401, { message: "bad trip or key" });
        const rows = [...cards.entries()]
          .filter(([k]) => k.startsWith(`${args.p_trip}:`))
          .map(([, v]) => v)
          .filter((v) => args.p_round == null || v.round === args.p_round);
        return send(200, rows);
      }
      if (fn === "gts_complete_round") {
        if (!trip || trip.readKey !== args.p_key) return send(401, { message: "bad trip or key" });
        const key = `${args.p_trip}:${args.p_round}`;
        if (args.p_completed) completed.add(key);
        else completed.delete(key);
        return send(204);
      }
      if (fn === "gts_save_trip_state") {
        if (!trip || trip.readKey !== args.p_key) return send(401, { message: "bad trip or key" });
        tripState.set(args.p_trip, { state: args.p_state, updated_at: new Date().toISOString() });
        return send(204);
      }
      if (fn === "gts_load_trip_state") {
        if (!trip || trip.readKey !== args.p_key) return send(401, { message: "bad trip or key" });
        const row = tripState.get(args.p_trip);
        return send(200, row ? [row] : []);
      }
      if (fn === "gts_list_trips") {
        const rows = [...trips.entries()].map(([id, t]) => {
          const s = tripState.get(id);
          return {
            id, write_key: t.writeKey, read_key: t.readKey,
            state: s ? s.state : null, updated_at: s ? s.updated_at : new Date(0).toISOString(),
          };
        });
        return send(200, rows);
      }
      if (fn === "gts_delete_trip") {
        if (!trip || trip.readKey !== args.p_key) return send(401, { message: "bad trip or key" });
        trips.delete(args.p_trip);
        for (const k of [...cards.keys()]) if (k.startsWith(`${args.p_trip}:`)) cards.delete(k);
        for (const k of [...completed]) if (k.startsWith(`${args.p_trip}:`)) completed.delete(k);
        tripState.delete(args.p_trip);
        return send(204);
      }
      send(404, { message: "unknown rpc" });
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}
