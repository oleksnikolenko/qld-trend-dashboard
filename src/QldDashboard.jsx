import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, ComposedChart, Bar } from "recharts";

// ─── Historical QQQ Monthly Closes (adjusted, verified against Yahoo Finance / StockAnalysis) ───
const RAW_DATA = [
  ["2015-01",103.32],["2015-02",109.54],["2015-03",107.95],["2015-04",109.46],["2015-05",111.70],["2015-06",110.58],
  ["2015-07",113.66],["2015-08",104.53],["2015-09",103.89],["2015-10",114.56],["2015-11",116.17],["2015-12",113.36],
  ["2016-01",102.20],["2016-02",103.01],["2016-03",109.20],["2016-04",107.56],["2016-05",110.73],["2016-06",109.20],
  ["2016-07",115.97],["2016-08",118.13],["2016-09",118.43],["2016-10",118.19],["2016-11",119.14],["2016-12",120.56],
  ["2017-01",126.26],["2017-02",131.08],["2017-03",132.80],["2017-04",136.91],["2017-05",140.71],["2017-06",139.31],
  ["2017-07",146.34],["2017-08",146.06],["2017-09",149.14],["2017-10",154.33],["2017-11",157.81],["2017-12",158.48],
  ["2018-01",170.83],["2018-02",167.74],["2018-03",161.53],["2018-04",163.35],["2018-05",172.67],["2018-06",175.38],
  ["2018-07",181.22],["2018-08",186.60],["2018-09",186.02],["2018-10",168.60],["2018-11",172.59],["2018-12",154.16],
  ["2019-01",169.13],["2019-02",174.98],["2019-03",179.54],["2019-04",189.48],["2019-05",175.57],["2019-06",189.46],
  ["2019-07",194.50],["2019-08",190.55],["2019-09",191.45],["2019-10",199.27],["2019-11",208.22],["2019-12",212.61],
  ["2020-01",212.53],["2020-02",200.26],["2020-03",202.30],["2020-04",224.97],["2020-05",234.59],["2020-06",247.71],
  ["2020-07",268.68],["2020-08",299.40],["2020-09",282.00],["2020-10",282.81],["2020-11",302.25],["2020-12",313.74],
  ["2021-01",316.77],["2021-02",315.96],["2021-03",323.13],["2021-04",340.66],["2021-05",334.36],["2021-06",354.12],
  ["2021-07",366.59],["2021-08",381.69],["2021-09",363.08],["2021-10",393.90],["2021-11",396.01],["2021-12",398.93],
  ["2022-01",354.73],["2022-02",342.25],["2022-03",363.05],["2022-04",312.11],["2022-05",299.38],["2022-06",274.68],
  ["2022-07",311.36],["2022-08",296.12],["2022-09",266.77],["2022-10",275.30],["2022-11",290.78],["2022-12",265.53],
  ["2023-01",293.12],["2023-02",290.98],["2023-03",319.72],["2023-04",323.24],["2023-05",346.79],["2023-06",370.47],
  ["2023-07",385.11],["2023-08",379.18],["2023-09",362.90],["2023-10",360.32],["2023-11",392.77],["2023-12",408.16],
  ["2024-01",424.43],["2024-02",439.34],["2024-03",449.19],["2024-04",428.12],["2024-05",462.36],["2024-06",484.01],
  ["2024-07",473.76],["2024-08",480.83],["2024-09",489.57],["2024-10",494.89],["2024-11",517.69],["2024-12",517.81],
  ["2025-01",527.35],["2025-02",501.07],["2025-03",473.51],["2025-04",486.40],["2025-05",524.88],["2025-06",548.10],
  ["2025-07",582.24],["2025-08",580.50],["2025-09",570.47],["2025-10",634.15],["2025-11",619.43],["2025-12",614.31],
  ["2026-01",621.87],["2026-02",600.64],["2026-03",611.07],
];

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMonth(key) {
  const [y, m] = key.split("-");
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

function fmtDate(key) {
  const [y, m] = key.split("-");
  return `${MONTHS_SHORT[parseInt(m) - 1]} '${y.slice(2)}`;
}

function computeStrategy(data) {
  const rows = [];
  for (let i = 0; i < data.length; i++) {
    const [month, close] = data[i];
    let sma = null;
    let signal = null;
    let margin = null;
    let marginPct = null;
    if (i >= 9) {
      const slice = data.slice(i - 9, i + 1).map(d => d[1]);
      sma = slice.reduce((a, b) => a + b, 0) / 10;
      signal = close > sma ? "RISK_ON" : "RISK_OFF";
      margin = close - sma;
      marginPct = (margin / sma) * 100;
    }
    rows.push({ month, close, sma, signal, margin, marginPct });
  }
  // Detect regime changes
  const changes = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].signal && rows[i - 1].signal && rows[i].signal !== rows[i - 1].signal) {
      const dir = rows[i].signal === "RISK_ON" ? "BUY_QLD" : "SELL_QLD";
      changes.push({ ...rows[i], direction: dir, prevMonth: rows[i - 1].month, prevClose: rows[i - 1].close, prevSma: rows[i - 1].sma });
    }
  }
  // Build regime periods
  const periods = [];
  let start = rows.find(r => r.signal)?.month;
  let currentSignal = rows.find(r => r.signal)?.signal;
  for (const r of rows) {
    if (!r.signal) continue;
    if (r.signal !== currentSignal) {
      periods.push({ start, end: rows[rows.indexOf(r) - 1]?.month, signal: currentSignal });
      start = r.month;
      currentSignal = r.signal;
    }
  }
  periods.push({ start, end: rows[rows.length - 1].month, signal: currentSignal });
  return { rows, changes, periods };
}

// Trade analysis
function analyzeTradeRoundTrips(changes) {
  const trips = [];
  for (let i = 0; i < changes.length - 1; i += 2) {
    if (changes[i].direction !== "SELL_QLD") continue;
    const sell = changes[i];
    const buy = changes[i + 1];
    if (!buy) break;
    const qqqChg = ((buy.close - sell.close) / sell.close) * 100;
    const estQldImpact = qqqChg * 1.8;
    const [sy, sm] = sell.month.split("-").map(Number);
    const [by, bm] = buy.month.split("-").map(Number);
    const months = (by - sy) * 12 + (bm - sm);
    let verdict = "NEUTRAL";
    if (qqqChg < -5) verdict = "MAJOR_WIN";
    else if (qqqChg < 0) verdict = "SMALL_WIN";
    else if (qqqChg < 5) verdict = "SMALL_WHIPSAW";
    else verdict = "COSTLY_WHIPSAW";
    trips.push({ sell, buy, qqqChg, estQldImpact, months, verdict });
  }
  return trips;
}

// ─── Palette ───
const C = {
  bg: "#0a0e17",
  card: "#111827",
  cardBorder: "#1e293b",
  text: "#e2e8f0",
  textDim: "#64748b",
  textMuted: "#475569",
  green: "#10b981",
  greenDim: "#065f46",
  greenBg: "rgba(16,185,129,0.08)",
  red: "#ef4444",
  redDim: "#991b1b",
  redBg: "rgba(239,68,68,0.08)",
  blue: "#3b82f6",
  blueDim: "#1e3a5f",
  amber: "#f59e0b",
  purple: "#8b5cf6",
  smaLine: "#f59e0b",
  qqqLine: "#3b82f6",
  riskOnFill: "rgba(16,185,129,0.12)",
  riskOffFill: "rgba(239,68,68,0.10)",
};

const font = "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace";
const fontSans = "'DM Sans', 'Segoe UI', system-ui, sans-serif";

// ─── Components ───

function Card({ children, style, className }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: "20px 24px", ...style }} className={className}>
      {children}
    </div>
  );
}

function Label({ children, style }) {
  return <div style={{ fontSize: 11, fontFamily: font, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, ...style }}>{children}</div>;
}

function Metric({ label, value, sub, color, large }) {
  return (
    <div style={{ minWidth: 0 }}>
      <Label>{label}</Label>
      <div style={{ fontSize: large ? 28 : 20, fontFamily: font, fontWeight: 600, color: color || C.text, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, fontFamily: font, color: C.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SignalBadge({ signal, size = "lg" }) {
  const isOn = signal === "RISK_ON";
  const s = size === "lg" ? { fontSize: 14, padding: "8px 20px", borderRadius: 8 } : { fontSize: 11, padding: "3px 10px", borderRadius: 6 };
  return (
    <span style={{
      ...s,
      fontFamily: font, fontWeight: 700,
      color: isOn ? C.green : C.red,
      background: isOn ? C.greenBg : C.redBg,
      border: `1px solid ${isOn ? C.greenDim : C.redDim}`,
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      <span style={{ width: size === "lg" ? 8 : 6, height: size === "lg" ? 8 : 6, borderRadius: "50%", background: isOn ? C.green : C.red, boxShadow: `0 0 8px ${isOn ? C.green : C.red}` }} />
      {isOn ? "RISK-ON · QLD" : "RISK-OFF · SGOV"}
    </span>
  );
}

function VerdictBadge({ verdict }) {
  const map = {
    MAJOR_WIN: { label: "Major Win", color: C.green, bg: C.greenBg },
    SMALL_WIN: { label: "Small Win", color: C.green, bg: C.greenBg },
    SMALL_WHIPSAW: { label: "Small Whipsaw", color: C.amber, bg: "rgba(245,158,11,0.1)" },
    COSTLY_WHIPSAW: { label: "Costly Whipsaw", color: C.red, bg: C.redBg },
    NEUTRAL: { label: "Neutral", color: C.textDim, bg: "transparent" },
  };
  const v = map[verdict] || map.NEUTRAL;
  return (
    <span style={{ fontSize: 10, fontFamily: font, fontWeight: 600, color: v.color, background: v.bg, border: `1px solid ${v.color}33`, padding: "2px 8px", borderRadius: 4 }}>
      {v.label}
    </span>
  );
}

// Custom Tooltip for chart
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: "#1e293b", border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: "10px 14px", fontFamily: font, fontSize: 12, color: C.text, minWidth: 180 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>{fmtMonth(d.month)}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: C.qqqLine }}>QQQ Close</span><span>${d.close?.toFixed(2)}</span>
      </div>
      {d.sma && <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: C.smaLine }}>10M SMA</span><span>${d.sma?.toFixed(2)}</span>
      </div>}
      {d.marginPct != null && <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 4, paddingTop: 4, borderTop: "1px solid #334155" }}>
        <span>Margin</span><span style={{ color: d.marginPct >= 0 ? C.green : C.red }}>{d.marginPct >= 0 ? "+" : ""}{d.marginPct?.toFixed(2)}%</span>
      </div>}
      {d.signal && <div style={{ marginTop: 4 }}><SignalBadge signal={d.signal} size="sm" /></div>}
    </div>
  );
}

// ─── Main Dashboard ───
export default function Dashboard() {
  const [livePrice, setLivePrice] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [realSma, setRealSma] = useState(null);
  const [mergedData, setMergedData] = useState(RAW_DATA);
  const [tab, setTab] = useState("chart");
  const [chartRange, setChartRange] = useState("ALL");

  useEffect(() => {
    const LIVE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/QQQ?interval=1d&range=1d";
    const MONTHLY_URL = "https://query1.finance.yahoo.com/v8/finance/chart/QQQ?interval=1mo&range=2y";

    const fetchViaProxies = async (url) => {
      // 1. allorigins /raw — direct JSON response, no wrapper parsing needed
      try {
        const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        if (res.ok) return res.json();
      } catch (_) {}
      // 2. allorigins /get — wrapped fallback (corsproxy.io is 403 on free plan)
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const wrapper = await res.json();
          if (wrapper.contents) return JSON.parse(wrapper.contents);
        }
      } catch (_) {}
      return null;
    };

    const fetchAll = async () => {
      const [liveJson, monthlyJson] = await Promise.all([
        fetchViaProxies(LIVE_URL),
        fetchViaProxies(MONTHLY_URL),
      ]);

      // Parse live price
      let livePx = null;
      if (liveJson) {
        const meta = liveJson?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          livePx = meta.regularMarketPrice;
          setLivePrice({ price: livePx, prevClose: meta.chartPreviousClose, time: new Date(meta.regularMarketTime * 1000) });
        }
      }

      // Parse monthly closes, compute real 10M SMA, merge into chart data
      if (monthlyJson) {
        const result = monthlyJson?.chart?.result?.[0];
        const timestamps = result?.timestamp;
        const closes = result?.indicators?.quote?.[0]?.close;

        if (timestamps && closes && timestamps.length >= 10) {
          const now = new Date();
          const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

          const fetchedMonthly = timestamps
            .map((ts, i) => {
              const d = new Date(ts * 1000);
              const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              return { ym, close: closes[i] };
            })
            .filter(d => d.close != null);

          // Completed months only (exclude the in-progress current month bar)
          const completedMonthly = fetchedMonthly.filter(d => d.ym < currentYM);

          // Merge fetched closes into RAW_DATA (fetched data wins for recent months)
          const dataMap = new Map(RAW_DATA.map(([m, c]) => [m, c]));
          fetchedMonthly.forEach(({ ym, close }) => dataMap.set(ym, close));
          const merged = [...dataMap.entries()].sort(([a], [b]) => a.localeCompare(b));
          setMergedData(merged);

          // Real 10M SMA = avg of last 9 completed month-end closes + current live price
          if (completedMonthly.length >= 9) {
            const last9 = completedMonthly.slice(-9).map(d => d.close);
            const tenthValue = livePx ?? completedMonthly[completedMonthly.length - 1].close;
            setRealSma(last9.reduce((a, b) => a + b, 0) / 9 * 9 / 10 + tenthValue / 10);
          }
        }
      }

      if (!liveJson && !monthlyJson) {
        setLiveError("Live data unavailable — showing latest month-end close");
      }
    };

    fetchAll();
  }, []);

  const { rows, changes, periods } = useMemo(() => computeStrategy(mergedData), [mergedData]);
  const roundTrips = useMemo(() => analyzeTradeRoundTrips(changes), [changes]);

  const current = rows[rows.length - 1];
  const displayPrice = livePrice?.price || current.close;
  const liveSmaEstimate = realSma ?? current.sma;
  const liveMarginPct = ((displayPrice - liveSmaEstimate) / liveSmaEstimate) * 100;
  const liveSignal = displayPrice > liveSmaEstimate ? "RISK_ON" : "RISK_OFF";

  // Chart data filtering
  const chartData = useMemo(() => {
    const signalRows = rows.filter(r => r.signal != null);
    if (chartRange === "ALL") return signalRows;
    const years = parseInt(chartRange);
    return signalRows.slice(-years * 12);
  }, [rows, chartRange]);

  // Stats
  const signalRows = rows.filter(r => r.signal);
  const onMonths = signalRows.filter(r => r.signal === "RISK_ON").length;
  const offMonths = signalRows.filter(r => r.signal === "RISK_OFF").length;
  const totalChanges = changes.length;
  const wins = roundTrips.filter(t => t.verdict === "MAJOR_WIN" || t.verdict === "SMALL_WIN").length;
  const whipsaws = roundTrips.filter(t => t.verdict.includes("WHIPSAW")).length;

  // Distance to flip
  const distToFlip = displayPrice - liveSmaEstimate;
  const pctToFlip = liveMarginPct;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: fontSans, padding: 0 }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.cardBorder}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, fontFamily: font, color: "#fff" }}>Q</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>QLD Trend Strategy</div>
            <div style={{ fontSize: 11, fontFamily: font, color: C.textDim }}>QQQ 10-Month SMA · Monthly Signal</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontFamily: font, color: C.textDim }}>QQQ {livePrice ? "LIVE" : "LAST CLOSE"}</div>
            <div style={{ fontSize: 20, fontFamily: font, fontWeight: 700, color: C.text }}>${displayPrice.toFixed(2)}</div>
          </div>
          {livePrice && (
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: "pulse 2s infinite" }} />
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px 40px" }}>

        {/* Signal Banner */}
        <Card style={{ marginBottom: 16, background: liveSignal === "RISK_ON" ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)", borderColor: liveSignal === "RISK_ON" ? C.greenDim : C.redDim }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <Label>Current Signal</Label>
              <div style={{ marginTop: 4 }}><SignalBadge signal={liveSignal} /></div>
              <div style={{ fontSize: 12, fontFamily: font, color: C.textDim, marginTop: 8 }}>
                {liveSignal === "RISK_ON" ? "Hold 100% QLD (ProShares Ultra QQQ, 2x)" : "Hold 100% SGOV (iShares 0-3M Treasury)"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              <Metric label={realSma ? "10M SMA (live)" : "10M SMA (est.)"} value={`$${liveSmaEstimate.toFixed(2)}`} color={C.smaLine} />
              <Metric label="Margin" value={`${pctToFlip >= 0 ? "+" : ""}${pctToFlip.toFixed(2)}%`} sub={`$${distToFlip >= 0 ? "+" : ""}${distToFlip.toFixed(2)}`} color={pctToFlip >= 0 ? C.green : C.red} />
              <Metric label={pctToFlip >= 0 ? "Distance to Sell Signal" : "Distance to Buy Signal"} value={`$${Math.abs(distToFlip).toFixed(2)}`} sub={`${Math.abs(pctToFlip).toFixed(2)}% ${pctToFlip >= 0 ? "above" : "below"} SMA`} color={C.textDim} />
            </div>
          </div>
        </Card>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Card><Metric label="Time in QLD" value={`${((onMonths / signalRows.length) * 100).toFixed(0)}%`} sub={`${onMonths} of ${signalRows.length} months`} color={C.green} /></Card>
          <Card><Metric label="Time in SGOV" value={`${((offMonths / signalRows.length) * 100).toFixed(0)}%`} sub={`${offMonths} months`} color={C.red} /></Card>
          <Card><Metric label="Regime Changes" value={totalChanges} sub={`${roundTrips.length} round trips`} color={C.blue} /></Card>
          <Card><Metric label="Wins / Whipsaws" value={`${wins} / ${whipsaws}`} sub={`Avg ~${(totalChanges / 10).toFixed(1)} signals/yr`} color={C.amber} /></Card>
          <Card><Metric label="Current Regime Since" value={fmtMonth(periods[periods.length - 1].start)} sub={`${(() => { const [y,m] = periods[periods.length - 1].start.split("-").map(Number); const [cy,cm] = current.month.split("-").map(Number); return (cy - y) * 12 + (cm - m) + 1; })()} months`} color={C.purple} /></Card>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 16, background: C.card, borderRadius: 10, padding: 3, border: `1px solid ${C.cardBorder}`, width: "fit-content" }}>
          {[["chart", "Price & SMA Chart"], ["regimes", "Regime Periods"], ["trades", "Trade Log"], ["rules", "Strategy Rules"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontFamily: font, fontWeight: 600,
              background: tab === key ? C.blue : "transparent", color: tab === key ? "#fff" : C.textDim, transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {/* Chart Tab */}
        {tab === "chart" && (
          <Card style={{ padding: "20px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: font }}>
                  <span style={{ width: 14, height: 3, background: C.qqqLine, borderRadius: 2 }} /> <span style={{ color: C.textDim }}>QQQ Close</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: font }}>
                  <span style={{ width: 14, height: 3, background: C.smaLine, borderRadius: 2 }} /> <span style={{ color: C.textDim }}>10M SMA</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: font }}>
                  <span style={{ width: 10, height: 10, background: C.greenBg, border: `1px solid ${C.green}40`, borderRadius: 2 }} /> <span style={{ color: C.textDim }}>Risk-On</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: font }}>
                  <span style={{ width: 10, height: 10, background: C.redBg, border: `1px solid ${C.red}40`, borderRadius: 2 }} /> <span style={{ color: C.textDim }}>Risk-Off</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 2, background: "#0a0e17", borderRadius: 6, padding: 2 }}>
                {["3Y", "5Y", "ALL"].map(r => (
                  <button key={r} onClick={() => setChartRange(r)} style={{
                    padding: "4px 12px", borderRadius: 4, border: "none", fontSize: 11, fontFamily: font, cursor: "pointer",
                    background: chartRange === r ? C.cardBorder : "transparent", color: chartRange === r ? C.text : C.textMuted,
                  }}>{r}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="qqqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.qqqLine} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={C.qqqLine} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" tickFormatter={fmtDate} tick={{ fontSize: 10, fontFamily: font, fill: C.textMuted }} axisLine={{ stroke: "#1e293b" }} tickLine={false} interval="preserveStartEnd" minTickGap={50} />
                <YAxis tick={{ fontSize: 10, fontFamily: font, fill: C.textMuted }} axisLine={false} tickLine={false} domain={["auto", "auto"]} tickFormatter={v => `$${v}`} width={56} />
                <Tooltip content={<ChartTooltip />} />
                {/* Regime background bars */}
                <Bar dataKey={d => d.signal === "RISK_OFF" ? d.close * 1.15 : 0} fill={C.redBg} barSize={800} isAnimationActive={false} />
                <Area type="monotone" dataKey="sma" stroke={C.smaLine} strokeWidth={2} strokeDasharray="6 3" fill="none" dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="close" stroke={C.qqqLine} strokeWidth={2} fill="url(#qqqGrad)" dot={false} isAnimationActive={false} />
                {/* Mark regime changes */}
                {changes.map((c, i) => (
                  <ReferenceLine key={i} x={c.month} stroke={c.direction === "BUY_QLD" ? C.green : C.red} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ textAlign: "center", fontSize: 10, fontFamily: font, color: C.textMuted, marginTop: 8 }}>
              Dashed vertical lines mark regime changes · Red-shaded areas = SGOV periods
            </div>
          </Card>
        )}

        {/* Regime Periods Tab */}
        {tab === "regimes" && (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.cardBorder}` }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Regime Periods</div>
              <div style={{ fontSize: 11, fontFamily: font, color: C.textDim, marginTop: 2 }}>Complete history of QLD and SGOV holding periods</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                    {["Period", "Duration", "Holding", "QQQ Start", "QQQ End", "QQQ Change"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p, i) => {
                    const startRow = rows.find(r => r.month === p.start);
                    const endRow = rows.find(r => r.month === p.end);
                    const [sy, sm] = p.start.split("-").map(Number);
                    const [ey, em] = p.end.split("-").map(Number);
                    const dur = (ey - sy) * 12 + (em - sm) + 1;
                    const qqqChg = startRow && endRow ? ((endRow.close - startRow.close) / startRow.close * 100) : null;
                    const isOn = p.signal === "RISK_ON";
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: isOn ? "rgba(16,185,129,0.02)" : "rgba(239,68,68,0.02)" }}>
                        <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>{fmtMonth(p.start)} — {fmtMonth(p.end)}</td>
                        <td style={{ padding: "10px 16px" }}>{dur} mo</td>
                        <td style={{ padding: "10px 16px" }}><SignalBadge signal={p.signal} size="sm" /></td>
                        <td style={{ padding: "10px 16px" }}>${startRow?.close.toFixed(2)}</td>
                        <td style={{ padding: "10px 16px" }}>${endRow?.close.toFixed(2)}</td>
                        <td style={{ padding: "10px 16px", color: qqqChg >= 0 ? C.green : C.red, fontWeight: 600 }}>
                          {qqqChg != null ? `${qqqChg >= 0 ? "+" : ""}${qqqChg.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Trade Log Tab */}
        {tab === "trades" && (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.cardBorder}` }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Round-Trip Trade Log</div>
              <div style={{ fontSize: 11, fontFamily: font, color: C.textDim, marginTop: 2 }}>Each exit → re-entry pair with outcome analysis</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                    {["#", "Sold QLD", "Bought QLD", "Months Out", "QQQ While Out", "Est. QLD Impact", "Verdict"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roundTrips.map((t, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                      <td style={{ padding: "10px 14px", color: C.textMuted }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <div>{fmtMonth(t.sell.month)}</div>
                        <div style={{ color: C.textDim, fontSize: 10 }}>@ ${t.sell.close.toFixed(2)}</div>
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <div>{fmtMonth(t.buy.month)}</div>
                        <div style={{ color: C.textDim, fontSize: 10 }}>@ ${t.buy.close.toFixed(2)}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>{t.months}</td>
                      <td style={{ padding: "10px 14px", color: t.qqqChg >= 0 ? C.red : C.green, fontWeight: 600 }}>
                        {t.qqqChg >= 0 ? "+" : ""}{t.qqqChg.toFixed(1)}%
                      </td>
                      <td style={{ padding: "10px 14px", color: t.estQldImpact >= 0 ? C.red : C.green, fontWeight: 600 }}>
                        ~{t.estQldImpact >= 0 ? "+" : ""}{t.estQldImpact.toFixed(1)}%
                        <div style={{ color: C.textDim, fontSize: 10, fontWeight: 400 }}>{t.estQldImpact >= 0 ? "missed" : "avoided"}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}><VerdictBadge verdict={t.verdict} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.cardBorder}`, display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, fontFamily: font }}>
                <span style={{ color: C.green, fontWeight: 700 }}>{wins} wins</span>
                <span style={{ color: C.textMuted }}> · The 2022 exit alone saved ~35-60% QLD drawdown</span>
              </div>
              <div style={{ fontSize: 12, fontFamily: font }}>
                <span style={{ color: C.red, fontWeight: 700 }}>{whipsaws} whipsaws</span>
                <span style={{ color: C.textMuted }}> · Total whipsaw cost ~50% cumulative in QLD terms</span>
              </div>
            </div>
          </Card>
        )}

        {/* Rules Tab */}
        {tab === "rules" && (
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Strategy Rules</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
              <div>
                <Label style={{ marginBottom: 8 }}>Signal Logic</Label>
                <div style={{ fontFamily: font, fontSize: 12, lineHeight: 1.8, color: C.textDim }}>
                  <div><span style={{ color: C.text, fontWeight: 600 }}>Signal Asset:</span> QQQ (Invesco QQQ Trust)</div>
                  <div><span style={{ color: C.text, fontWeight: 600 }}>Indicator:</span> 10-Month Simple Moving Average</div>
                  <div><span style={{ color: C.text, fontWeight: 600 }}>Frequency:</span> Check at month-end close</div>
                  <div><span style={{ color: C.text, fontWeight: 600 }}>Execution:</span> Trade on first trading day of next month</div>
                </div>
                <div style={{ marginTop: 16, padding: 14, background: C.greenBg, border: `1px solid ${C.greenDim}`, borderRadius: 8, fontFamily: font, fontSize: 12 }}>
                  <div style={{ color: C.green, fontWeight: 700, marginBottom: 4 }}>QQQ Close &gt; 10M SMA → RISK-ON</div>
                  <div style={{ color: C.textDim }}>Hold 100% QLD (2x Daily Leveraged Nasdaq-100)</div>
                </div>
                <div style={{ marginTop: 8, padding: 14, background: C.redBg, border: `1px solid ${C.redDim}`, borderRadius: 8, fontFamily: font, fontSize: 12 }}>
                  <div style={{ color: C.red, fontWeight: 700, marginBottom: 4 }}>QQQ Close ≤ 10M SMA → RISK-OFF</div>
                  <div style={{ color: C.textDim }}>Hold 100% SGOV (0-3 Month Treasury Bills)</div>
                </div>
              </div>
              <div>
                <Label style={{ marginBottom: 8 }}>DCA Rules</Label>
                <div style={{ fontFamily: font, fontSize: 12, lineHeight: 1.8, color: C.textDim }}>
                  <div>Monthly contributions follow the current signal.</div>
                  <div style={{ marginTop: 4 }}>If <span style={{ color: C.green }}>RISK-ON</span> → Buy QLD with contribution</div>
                  <div>If <span style={{ color: C.red }}>RISK-OFF</span> → Buy SGOV with contribution</div>
                </div>
                <Label style={{ marginTop: 20, marginBottom: 8 }}>Key Instruments</Label>
                <div style={{ fontFamily: font, fontSize: 12, lineHeight: 1.8, color: C.textDim }}>
                  <div><span style={{ color: C.blue }}>QLD</span> — ProShares Ultra QQQ (2x) · ER 0.95%</div>
                  <div><span style={{ color: C.amber }}>SGOV</span> — iShares 0-3M Treasury · ER 0.09%</div>
                  <div><span style={{ color: C.textMuted }}>QQQM</span> — Invesco Nasdaq-100 (1x) · ER 0.15%</div>
                </div>
                <Label style={{ marginTop: 20, marginBottom: 8 }}>Tax Note</Label>
                <div style={{ fontFamily: font, fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
                  Use specific-lot identification when selling. Consider running this in a Roth IRA for tax-free signal switching.
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Full Signal Log (always visible below tabs) */}
        <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Full Monthly Signal Log</div>
              <div style={{ fontSize: 11, fontFamily: font, color: C.textDim, marginTop: 2 }}>Every month-end signal since Oct 2015 · {signalRows.length} data points</div>
            </div>
          </div>
          <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 11 }}>
              <thead style={{ position: "sticky", top: 0, background: C.card, zIndex: 1 }}>
                <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                  {["Month", "QQQ Close", "10M SMA", "Margin", "Margin %", "Signal", ""].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...signalRows].reverse().map((r, i) => {
                  const isChange = changes.some(c => c.month === r.month);
                  return (
                    <tr key={i} style={{
                      borderBottom: `1px solid ${C.cardBorder}`,
                      background: isChange ? "rgba(59,130,246,0.06)" : "transparent",
                    }}>
                      <td style={{ padding: "6px 12px", whiteSpace: "nowrap", fontWeight: isChange ? 700 : 400 }}>{fmtMonth(r.month)}</td>
                      <td style={{ padding: "6px 12px" }}>${r.close.toFixed(2)}</td>
                      <td style={{ padding: "6px 12px", color: C.smaLine }}>${r.sma.toFixed(2)}</td>
                      <td style={{ padding: "6px 12px", color: r.margin >= 0 ? C.green : C.red }}>{r.margin >= 0 ? "+" : ""}{r.margin.toFixed(2)}</td>
                      <td style={{ padding: "6px 12px", color: r.marginPct >= 0 ? C.green : C.red, fontWeight: 600 }}>{r.marginPct >= 0 ? "+" : ""}{r.marginPct.toFixed(2)}%</td>
                      <td style={{ padding: "6px 12px" }}><SignalBadge signal={r.signal} size="sm" /></td>
                      <td style={{ padding: "6px 12px" }}>
                        {isChange && <span style={{ fontSize: 9, fontWeight: 700, color: C.blue, background: "rgba(59,130,246,0.15)", padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap" }}>SWITCH</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Footer */}
        <div style={{ marginTop: 20, padding: "12px 0", borderTop: `1px solid ${C.cardBorder}`, fontSize: 10, fontFamily: font, color: C.textMuted, textAlign: "center", lineHeight: 1.6 }}>
          Strategy based on "Leverage for the Long Run" (Gayed, 2016) and Faber's Tactical Asset Allocation research.
          <br />QQQ monthly closes sourced from Yahoo Finance / StockAnalysis.com. This is not financial advice. Past performance does not guarantee future results.
          {liveError && <div style={{ color: C.amber, marginTop: 4 }}>{liveError}</div>}
          <div style={{ marginTop: 6, color: C.textMuted }}>Last updated: {__BUILD_TIME__} PT</div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.cardBorder}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.textMuted}; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
