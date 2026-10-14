// Other sites' trade values, pulled from Dynasty Daddy, which collects them
// from each "market". Used by scripts/refresh-market-values.js to write
// data/market-values.js, which the trade calculator loads to show what each
// of these calculators thinks of a trade.
//
// Endpoint (no CORS header, so the page can't call it directly; the daily
// GitHub Action bakes it instead):
// - dynasty-daddy.com/api/v1/player/all/today?market=<n>
//   ~770 entries: skill players plus generic rookie picks ("2027 Early 1st").
//   Each has `trade_value` (1QB) and `sf_trade_value` (Superflex), and
//   players carry their Sleeper player_id. Dynasty Daddy's market numbers
//   (its FantasyMarket enum): 0 KeepTradeCut, 1 FantasyCalc, 2 DynastyProcess,
//   3 Dynasty Superflex, 4 KeepTradeCut redraft. FantasyCalc is skipped here,
//   since the page already pulls it live.
(function (root) {
  const URL = (market) => `https://dynasty-daddy.com/api/v1/player/all/today?market=${market}`;

  const MARKETS = [
    { key: "ktc", market: 0, label: "KeepTradeCut", url: "https://keeptradecut.com/trade-calculator", mode: "dynasty" },
    { key: "dp", market: 2, label: "DynastyProcess", url: "https://calc.dynastyprocess.com", mode: "dynasty" },
    { key: "dsf", market: 3, label: "Dynasty Superflex", url: "https://thedynastysuperflex.com", mode: "dynasty" },
    { key: "ktcRedraft", market: 4, label: "KeepTradeCut", url: "https://keeptradecut.com/trade-calculator", mode: "redraft" },
  ];

  // "2027 Early 1st" → "2027-1-early"; the same key pickKey() builds from a
  // FantasyCalc pick name.
  function ddPickKey(name) {
    const m = /^(\d{4}) (Early|Mid|Late) (\d)(?:st|nd|rd|th)$/.exec(name || "");
    return m ? `${m[1]}-${m[3]}-${m[2].toLowerCase()}` : null;
  }

  // { "1qb": { <sleeper id or pick key>: value }, sf: {...} }
  function trimMarket(entries) {
    const out = { "1qb": {}, sf: {} };
    for (const e of entries || []) {
      const key = e.position === "PI" ? ddPickKey(e.full_name) : e.sleeper_id;
      if (!key) continue;
      if (e.trade_value > 0) out["1qb"][key] = e.trade_value;
      if (e.sf_trade_value > 0) out.sf[key] = e.sf_trade_value;
    }
    return out;
  }

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Dynasty Daddy fetch failed (${res.status}): ${url}`);
    return res.json();
  }

  const fetchMarketRaw = (market) => getJson(URL(market));
  const fetchMarket = async (market) => trimMarket(await fetchMarketRaw(market));

  // A player's daily values over the last ~180 days, every market in one
  // row per day. `nameId` is Dynasty Daddy's own id ("bijanrobinsonrb"),
  // listed as name_id in the market feed.
  // - dynasty-daddy.com/api/v1/player/<name_id>?isAllTime=false
  const fetchHistory = (nameId) => getJson(`https://dynasty-daddy.com/api/v1/player/${encodeURIComponent(nameId)}?isAllTime=false`);

  // Which history field holds each market's value, by format.
  const HISTORY_FIELDS = {
    ktc: { "1qb": "trade_value", sf: "sf_trade_value" },
    dp: { "1qb": "dp_trade_value", sf: "dp_sf_trade_value" },
    dsf: { "1qb": "ds_trade_value", sf: "ds_sf_trade_value" },
  };

  const api = { MARKETS, HISTORY_FIELDS, fetchMarket, fetchMarketRaw, fetchHistory, trimMarket, ddPickKey };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DynastyDaddy = api;
})(typeof window !== "undefined" ? window : globalThis);
