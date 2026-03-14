import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Zap, TrendingUp, TrendingDown, DollarSign, Clock, Activity,
  AlertTriangle, CheckCircle, XCircle, WifiOff, Sun, Moon,
  BarChart2, PieChart as PieIcon, Globe, Shield, Cpu, Loader,
  ArrowUpRight, ArrowDownRight, Settings, Calendar
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { analyticsApi } from '../services/api';
import BottomNavigation from '../components/BottomNavigation';
import '../styles/Analytics.css';

// ─── Color palette ────────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#14B8A6'
];

const HEALTH_CONFIG = {
  NORMAL:   { color: '#10B981', Icon: CheckCircle, bg: '#D1FAE5' },
  WARNING:  { color: '#F59E0B', Icon: AlertTriangle, bg: '#FEF3C7' },
  CRITICAL: { color: '#EF4444', Icon: XCircle, bg: '#FEE2E2' },
  OFFLINE:  { color: '#6B7280', Icon: WifiOff, bg: '#F3F4F6' },
};

// ─── Demo / fallback data ─────────────────────────────────────────────────────
const DEMO_TIMELINE = [
  { time: 'Mon', energy: 4.2, cost: 29.4 }, { time: 'Tue', energy: 3.8, cost: 26.6 },
  { time: 'Wed', energy: 5.1, cost: 35.7 }, { time: 'Thu', energy: 4.6, cost: 32.2 },
  { time: 'Fri', energy: 6.3, cost: 44.1 }, { time: 'Sat', energy: 7.1, cost: 49.7 },
  { time: 'Sun', energy: 5.5, cost: 38.5 },
];

const DEMO_HOURLY = Array.from({ length: 24 }, (_, h) => {
  const base = h >= 6 && h <= 22 ? 0.8 : 0.2;
  const peak = (h >= 9 && h <= 11) || (h >= 18 && h <= 21) ? 1.5 : 1;
  return { hour: h, energy: +(base * peak * (0.7 + Math.random() * 0.6)).toFixed(3) };
});

const DEMO_WEEKLY_CURRENT = [
  { time: 'Mon', energy: 4.2 }, { time: 'Tue', energy: 3.8 }, { time: 'Wed', energy: 5.1 },
  { time: 'Thu', energy: 4.6 }, { time: 'Fri', energy: 6.3 }, { time: 'Sat', energy: 7.1 },
  { time: 'Sun', energy: 5.5 },
];
const DEMO_WEEKLY_PREV = [
  { time: 'Mon', energy: 5.0 }, { time: 'Tue', energy: 4.5 }, { time: 'Wed', energy: 4.8 },
  { time: 'Thu', energy: 5.2 }, { time: 'Fri', energy: 5.8 }, { time: 'Sat', energy: 6.5 },
  { time: 'Sun', energy: 6.0 },
];

const DEMO_SUMMARY = {
  totalEnergyKwh: 36.6, estimatedCostRs: 256.2, peakHour: '7 PM',
  activeDevices: 8, timeline: DEMO_TIMELINE,
  topDevices: [
    { deviceId: 1, deviceName: 'Air Conditioner', deviceType: 'HVAC', energyKwh: 12.4, costRs: 86.8, percentage: 33.9 },
    { deviceId: 2, deviceName: 'Water Heater', deviceType: 'heater', energyKwh: 8.2, costRs: 57.4, percentage: 22.4 },
    { deviceId: 3, deviceName: 'Refrigerator', deviceType: 'appliance', energyKwh: 5.8, costRs: 40.6, percentage: 15.8 },
    { deviceId: 4, deviceName: 'Washing Machine', deviceType: 'appliance', energyKwh: 4.1, costRs: 28.7, percentage: 11.2 },
    { deviceId: 5, deviceName: 'LED Lights', deviceType: 'lighting', energyKwh: 3.5, costRs: 24.5, percentage: 9.6 },
    { deviceId: 6, deviceName: 'TV & Entertainment', deviceType: 'electronics', energyKwh: 2.6, costRs: 18.2, percentage: 7.1 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatHour = (h) => {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

const isPeakHour = (h) => (h >= 6 && h <= 9) || (h >= 18 && h <= 21);
const isMidPeak = (h) => (h >= 10 && h <= 17);

const getPeakColor = (h) => {
  if (isPeakHour(h)) return '#EF4444';
  if (isMidPeak(h)) return '#F59E0B';
  return '#10B981';
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border-color)',
      borderRadius: 12, padding: '10px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)'
    }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 12 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 700, fontSize: 14 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
          {p.name.toLowerCase().includes('energy') ? ' kWh' : ''}
          {p.name.toLowerCase().includes('cost') ? ' ₹' : ''}
        </p>
      ))}
    </div>
  );
};

const HourlyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border-color)',
      borderRadius: 12, padding: '10px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)'
    }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 4, fontSize: 12 }}>{formatHour(label)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 700, fontSize: 14 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value} kWh
        </p>
      ))}
      <p style={{ color: isPeakHour(label) ? '#EF4444' : isMidPeak(label) ? '#F59E0B' : '#10B981', fontSize: 11, marginTop: 4, fontWeight: 600 }}>
        {isPeakHour(label) ? '⚡ Peak Hours' : isMidPeak(label) ? '☀️ Mid-Peak' : '🌙 Off-Peak'}
      </p>
    </div>
  );
};

// ─── Summary Card ─────────────────────────────────────────────────────────────
const SummaryCard = ({ icon: Icon, label, value, unit, color, sub, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: 'spring', stiffness: 200 }}
    className="rounded-2xl p-5 border shadow-lg"
    style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
  >
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: color + '22' }}>
        <Icon size={20} style={{ color }} />
      </div>
    </div>
    <p className="text-3xl font-bold" style={{ color: 'var(--text-color)' }}>{value}</p>
    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{unit || sub}</p>
  </motion.div>
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, subtitle, color = '#10B981' }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <h2 className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>{title}</h2>
      {subtitle && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
    </div>
  </div>
);

// ─── Glass Card ───────────────────────────────────────────────────────────────
const GlassCard = ({ children, className = '', style = {} }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    className={`rounded-2xl p-6 border shadow-lg ${className}`}
    style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', ...style }}
  >
    {children}
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYTICS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const Analytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.roles?.[0] || user?.role || '';
  const isAdmin = role.toLowerCase().includes('admin');
  const isTechnician = role.toLowerCase().includes('technician');

  const [selectedPeriod, setSelectedPeriod] = useState('weekly');
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [healthData, setHealthData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [weeklyCurrentData, setWeeklyCurrentData] = useState([]);
  const [weeklyPrevData, setWeeklyPrevData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState(7); // ₹ per kWh

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (isTechnician && !isAdmin) setActiveTab('technician');
  }, [user]);

  // ── Data Fetchers ───────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async (period) => {
    try {
      const res = await analyticsApi.getSummaryAnalytics(period);
      setSummary(res.data);
    } catch { setSummary(null); }
  }, []);

  const fetchHourly = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await analyticsApi.getHourlyUsage(today);
      setHourlyData(res.data?.length ? res.data : []);
    } catch { setHourlyData([]); }
  }, []);

  const fetchWeeklyComparison = useCallback(async () => {
    try {
      const year = new Date().getFullYear();
      const res = await analyticsApi.getWeeklyUsage(year);
      const weeks = res.data || [];
      if (weeks.length >= 2) {
        setWeeklyCurrentData(weeks[weeks.length - 1]?.days || weeks.slice(-7));
        setWeeklyPrevData(weeks[weeks.length - 2]?.days || weeks.slice(-14, -7));
      } else {
        setWeeklyCurrentData([]); setWeeklyPrevData([]);
      }
    } catch { setWeeklyCurrentData([]); setWeeklyPrevData([]); }
  }, []);

  const fetchAdminData = useCallback(async (period) => {
    try { const res = await analyticsApi.getAdminGlobalAnalytics(period); setAdminData(res.data); }
    catch { setAdminData(null); }
  }, []);

  const fetchHealthData = useCallback(async () => {
    try { const res = await analyticsApi.getTechnicianDeviceHealth(); setHealthData(res.data); }
    catch { setHealthData([]); }
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true); setError('');
    const promises = [fetchSummary(selectedPeriod), fetchHourly(), fetchWeeklyComparison()];
    if (isAdmin) promises.push(fetchAdminData(selectedPeriod));
    if (isAdmin || isTechnician) promises.push(fetchHealthData());
    Promise.all(promises).finally(() => setLoading(false));
  }, [user, selectedPeriod]);

  // ── Computed values (with demo fallback) ────────────────────────────────────
  // Use demo data when API returns empty/zero data, not just when API fails
  const hasMeaningfulSummary = summary && (
    (summary.totalEnergyKwh > 0) ||
    (summary.timeline && summary.timeline.length > 0 && summary.timeline.some(t => t.energy > 0)) ||
    (summary.topDevices && summary.topDevices.length > 0)
  );
  const hasMeaningfulHourly = hourlyData.length > 0 && hourlyData.some(d => d.energy > 0);
  const hasMeaningfulWeekly = weeklyCurrentData.length > 0 && weeklyCurrentData.some(d => d.energy > 0);

  const effectiveSummary = hasMeaningfulSummary ? summary : DEMO_SUMMARY;
  const effectiveHourly = hasMeaningfulHourly ? hourlyData : DEMO_HOURLY;
  const effectiveWeeklyCurrent = hasMeaningfulWeekly ? weeklyCurrentData : DEMO_WEEKLY_CURRENT;
  const effectiveWeeklyPrev = (weeklyPrevData.length > 0 && weeklyPrevData.some(d => d.energy > 0)) ? weeklyPrevData : DEMO_WEEKLY_PREV;
  const usingDemo = !hasMeaningfulSummary;

  const totalEnergy = effectiveSummary.totalEnergyKwh || 0;
  const totalCost = totalEnergy * ratePerUnit;
  const timeline = (effectiveSummary.timeline && effectiveSummary.timeline.length > 0 && effectiveSummary.timeline.some(t => t.energy > 0))
    ? effectiveSummary.timeline : DEMO_TIMELINE;
  const avgDailyCost = timeline.length > 0 ? totalCost / timeline.length : 0;

  // Weekly comparison
  const currentWeekTotal = effectiveWeeklyCurrent.reduce((s, d) => s + (d.energy || 0), 0);
  const prevWeekTotal = effectiveWeeklyPrev.reduce((s, d) => s + (d.energy || 0), 0);
  const weeklyDiff = currentWeekTotal - prevWeekTotal;
  const weeklyPctChange = prevWeekTotal > 0 ? ((weeklyDiff / prevWeekTotal) * 100) : 0;
  const weeklyIncreased = weeklyDiff > 0;

  // Weekly comparison chart data
  const weeklyComparisonData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, i) => ({
      day,
      current: effectiveWeeklyCurrent[i]?.energy || 0,
      previous: effectiveWeeklyPrev[i]?.energy || 0,
    }));
  }, [effectiveWeeklyCurrent, effectiveWeeklyPrev]);

  // Peak analysis
  const peakAnalysis = useMemo(() => {
    if (!effectiveHourly.length) return { peakHour: 'N/A', offPeakHour: 'N/A', peakEnergy: 0, offPeakEnergy: 0 };
    let maxH = 0, minH = 0, maxE = -1, minE = Infinity;
    effectiveHourly.forEach(d => {
      if (d.energy > maxE) { maxE = d.energy; maxH = d.hour; }
      if (d.energy < minE) { minE = d.energy; minH = d.hour; }
    });
    const peakTotal = effectiveHourly.filter(d => isPeakHour(d.hour)).reduce((s, d) => s + d.energy, 0);
    const offPeakTotal = effectiveHourly.filter(d => !isPeakHour(d.hour) && !isMidPeak(d.hour)).reduce((s, d) => s + d.energy, 0);
    return { peakHour: formatHour(maxH), offPeakHour: formatHour(minH), peakEnergy: peakTotal, offPeakEnergy: offPeakTotal, peakMax: maxE, offPeakMin: minE };
  }, [effectiveHourly]);

  const periods = ['daily', 'weekly', 'monthly', 'yearly'];
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart2, show: true },
    { id: 'admin', label: 'Global', icon: Globe, show: isAdmin },
    { id: 'technician', label: 'Device Health', icon: Cpu, show: isAdmin || isTechnician },
  ].filter(t => t.show);

  return (
    <div className="min-h-screen pb-28" style={{ background: 'var(--bg-color)' }}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 backdrop-blur-xl border-b"
        style={{ background: 'var(--navbar-bg)', borderColor: 'var(--navbar-border)' }}>
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <Zap size={20} color="white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>Energy Analytics</h1>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Smart Home Energy Intelligence Platform
                {usingDemo && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>Demo Data</span>}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* ── Period Selector ──────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 justify-center flex-wrap">
          {periods.map(p => (
            <motion.button key={p} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedPeriod(p)}
              className="px-5 py-2 rounded-full font-semibold capitalize text-sm transition-all"
              style={selectedPeriod === p
                ? { background: 'linear-gradient(135deg,#10B981,#22C55E)', color: 'white', boxShadow: '0 4px 15px rgba(16,185,129,0.4)' }
                : { background: 'var(--glass-surface)', color: 'var(--text-secondary)', border: '1.5px solid var(--border-color)' }
              }>{p}</motion.button>
          ))}
        </motion.div>

        {/* ── Role Tabs ───────────────────────────────────────────── */}
        {tabs.length > 1 && (
          <div className="flex gap-1 p-1 rounded-2xl border" style={{ background: 'var(--glass-surface)', borderColor: 'var(--border-color)' }}>
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold transition-all"
                style={activeTab === id ? { background: 'linear-gradient(135deg,#10B981,#22C55E)', color: 'white' } : { color: 'var(--text-secondary)' }}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Error Banner ─────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="p-4 rounded-2xl border-2 border-red-300 bg-red-50 flex gap-3 items-center">
              <AlertTriangle size={20} className="text-red-500" />
              <p className="text-red-700 font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Loader size={48} color="#10B981" />
            </motion.div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading analytics…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* ═══════════════ OVERVIEW TAB ═══════════════ */}
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">

                {/* ── 1. Summary Cards ──────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard icon={Zap} label="Total Energy" color="#10B981"
                    value={totalEnergy.toFixed(2)} unit="kWh consumed" delay={0.05} />
                  <SummaryCard icon={DollarSign} label="Estimated Cost" color="#F59E0B"
                    value={`₹${totalCost.toFixed(2)}`} unit={`@ ₹${ratePerUnit}/kWh`} delay={0.1} />
                  <SummaryCard icon={Clock} label="Peak Hour" color="#8B5CF6"
                    value={peakAnalysis.peakHour} unit="highest usage" delay={0.15} />
                  <SummaryCard icon={Activity} label="Weekly Change" color={weeklyIncreased ? '#EF4444' : '#10B981'}
                    value={`${weeklyIncreased ? '+' : ''}${weeklyPctChange.toFixed(1)}%`}
                    unit={weeklyIncreased ? 'more than last week' : 'less than last week'} delay={0.2} />
                </div>

                {/* ── 2. Consumption Pattern Charts ─────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Line Chart — Energy Timeline */}
                  <GlassCard>
                    <SectionHeader icon={TrendingUp} title="Energy Usage Timeline" subtitle={`${selectedPeriod} consumption trend`} />
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={timeline} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <defs>
                          <linearGradient id="energyLine" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="energy" name="Energy (kWh)" stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={{ r: 6, fill: '#10B981' }} />
                        <Line type="monotone" dataKey="cost" name="Cost (₹)" stroke="#F59E0B" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#F59E0B' }} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </GlassCard>

                  {/* Bar Chart — Daily Usage */}
                  <GlassCard>
                    <SectionHeader icon={BarChart2} title="Daily Consumption" subtitle="Energy usage distribution" color="#3B82F6" />
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={timeline} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" />
                            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="energy" name="Energy (kWh)" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassCard>
                </div>

                {/* ── 3. Weekly Comparison ──────────────────────────── */}
                <GlassCard>
                  <SectionHeader icon={Calendar} title="Weekly Comparison" subtitle="Current week vs previous week" color="#8B5CF6" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Current Week */}
                    <div className="rounded-xl p-4 border" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>This Week</p>
                      <p className="text-2xl font-bold" style={{ color: '#10B981' }}>{currentWeekTotal.toFixed(2)} <span className="text-sm font-medium">kWh</span></p>
                    </div>
                    {/* Previous Week */}
                    <div className="rounded-xl p-4 border" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Last Week</p>
                      <p className="text-2xl font-bold" style={{ color: '#3B82F6' }}>{prevWeekTotal.toFixed(2)} <span className="text-sm font-medium">kWh</span></p>
                    </div>
                    {/* Change */}
                    <div className={`rounded-xl p-4 border ${weeklyIncreased ? 'comparison-badge-up' : 'comparison-badge-down'}`}>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Change</p>
                      <div className="flex items-center gap-2">
                        {weeklyIncreased ? <ArrowUpRight size={22} color="#EF4444" /> : <ArrowDownRight size={22} color="#10B981" />}
                        <p className="text-2xl font-bold">{Math.abs(weeklyPctChange).toFixed(1)}%</p>
                      </div>
                      <p className="text-xs mt-1 font-semibold">{weeklyIncreased ? '↑ Consumption increased' : '↓ Consumption decreased'}</p>
                    </div>
                  </div>
                  {/* Comparison Bar Chart */}
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyComparisonData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="current" name="This Week (kWh)" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="previous" name="Last Week (kWh)" fill="#3B82F680" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </GlassCard>

                {/* ── 4. Energy Cost Prediction ─────────────────────── */}
                <GlassCard>
                  <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
                    <SectionHeader icon={DollarSign} title="Energy Cost Prediction" subtitle="Based on your consumption data" color="#F59E0B" />
                    <div className="flex items-center gap-2">
                      <Settings size={16} style={{ color: 'var(--text-secondary)' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Rate:</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>₹</span>
                      <input type="number" className="rate-input" value={ratePerUnit} min={0} step={0.5}
                        onChange={(e) => setRatePerUnit(parseFloat(e.target.value) || 0)} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>/kWh</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                      className="rounded-xl p-5 text-center border" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
                      <Zap size={24} className="mx-auto mb-2" style={{ color: '#10B981' }} />
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Total Energy Consumed</p>
                      <p className="text-3xl font-bold" style={{ color: '#10B981' }}>{totalEnergy.toFixed(2)}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>kWh</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                      className="rounded-xl p-5 text-center border" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}>
                      <DollarSign size={24} className="mx-auto mb-2" style={{ color: '#F59E0B' }} />
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Total Estimated Cost</p>
                      <p className="text-3xl font-bold" style={{ color: '#F59E0B' }}>₹{totalCost.toFixed(2)}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>at ₹{ratePerUnit}/kWh</p>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                      className="rounded-xl p-5 text-center border" style={{ background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)' }}>
                      <TrendingUp size={24} className="mx-auto mb-2" style={{ color: '#8B5CF6' }} />
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Average Daily Cost</p>
                      <p className="text-3xl font-bold" style={{ color: '#8B5CF6' }}>₹{avgDailyCost.toFixed(2)}</p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>per day</p>
                    </motion.div>
                  </div>
                </GlassCard>

                {/* ── 5. Peak vs Off-Peak Usage ─────────────────────── */}
                <GlassCard>
                  <SectionHeader icon={Sun} title="Peak vs Off-Peak Usage" subtitle="24-hour energy consumption analysis" color="#EF4444" />
                  {/* Summary strip */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.08)' }}>
                      <p className="text-[10px] font-bold uppercase" style={{ color: '#EF4444' }}>Peak Hour</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>{peakAnalysis.peakHour}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
                      <p className="text-[10px] font-bold uppercase" style={{ color: '#10B981' }}>Off-Peak Hour</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-color)' }}>{peakAnalysis.offPeakHour}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.08)' }}>
                      <p className="text-[10px] font-bold uppercase" style={{ color: '#EF4444' }}>Peak Total</p>
                      <p className="text-lg font-bold" style={{ color: '#EF4444' }}>{peakAnalysis.peakEnergy.toFixed(2)} kWh</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.08)' }}>
                      <p className="text-[10px] font-bold uppercase" style={{ color: '#10B981' }}>Off-Peak Total</p>
                      <p className="text-lg font-bold" style={{ color: '#10B981' }}>{peakAnalysis.offPeakEnergy.toFixed(2)} kWh</p>
                    </div>
                  </div>
                  {/* Hourly Bar Chart with peak coloring */}
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={effectiveHourly} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                      <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} interval={1} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                      <Tooltip content={<HourlyTooltip />} />
                      <Bar dataKey="energy" name="Energy (kWh)" radius={[4, 4, 0, 0]}>
                        {effectiveHourly.map((entry, i) => (
                          <Cell key={i} fill={getPeakColor(entry.hour)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="flex justify-center gap-6 mt-4">
                    {[{ label: 'Peak (6-9 AM, 6-9 PM)', color: '#EF4444' }, { label: 'Mid-Peak (10 AM-5 PM)', color: '#F59E0B' }, { label: 'Off-Peak (10 PM-5 AM)', color: '#10B981' }].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} /> {l.label}
                      </div>
                    ))}
                  </div>
                </GlassCard>

                {/* ── Top Devices — Bar + Pie ──────────────────────── */}
                {effectiveSummary.topDevices?.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GlassCard>
                      <SectionHeader icon={BarChart2} title="Top Devices by Usage" color="#3B82F6" />
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={effectiveSummary.topDevices.slice(0, 6).map(d => ({
                          name: d.deviceName?.length > 10 ? d.deviceName.slice(0, 9) + '…' : d.deviceName, energy: d.energyKwh,
                        }))} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="energy" name="Energy (kWh)" radius={[6, 6, 0, 0]}>
                            {effectiveSummary.topDevices.slice(0, 6).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </GlassCard>
                    <GlassCard>
                      <SectionHeader icon={PieIcon} title="Consumption Share" color="#8B5CF6" />
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={effectiveSummary.topDevices.slice(0, 6).map(d => ({
                            name: d.deviceName, value: parseFloat(d.energyKwh.toFixed(3)),
                          }))} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                            {effectiveSummary.topDevices.slice(0, 6).map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => [`${v} kWh`, 'Energy']} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </GlassCard>
                  </div>
                )}

                {/* ── Device Breakdown List ────────────────────────── */}
                {effectiveSummary.topDevices?.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="rounded-2xl border shadow-lg overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                    <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-color)' }}>
                      <Zap size={18} color="#10B981" />
                      <h2 className="font-bold" style={{ color: 'var(--text-color)' }}>Device Breakdown</h2>
                    </div>
                    {effectiveSummary.topDevices.map((dev, i) => (
                      <motion.div key={dev.deviceId} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 + 0.4 }} className="px-6 py-4 border-b last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}>{i + 1}</div>
                            <div>
                              <p className="font-semibold" style={{ color: 'var(--text-color)' }}>{dev.deviceName}</p>
                              <p className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{dev.deviceType}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                              {(dev.energyKwh || 0).toFixed(4)}<span className="text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>kWh</span>
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>₹{(dev.costRs || 0).toFixed(2)} • {(dev.percentage || 0).toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(dev.percentage, 100)}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 + 0.5 }} className="h-full rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ═══════════════ ADMIN GLOBAL TAB ═══════════════ */}
            {activeTab === 'admin' && isAdmin && (
              <motion.div key="admin" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                {adminData ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <SummaryCard icon={Globe} label="Total System Energy" color="#10B981" value={(adminData.totalEnergyKwh || 0).toFixed(2)} unit="kWh across all homes" />
                      <SummaryCard icon={DollarSign} label="System Revenue" color="#F59E0B" value={`₹${(adminData.estimatedCostRs || 0).toFixed(0)}`} unit="estimated total cost" />
                      <SummaryCard icon={Shield} label="Households" color="#8B5CF6" value={adminData.totalHouseholds || 0} unit="registered users" />
                      <SummaryCard icon={Activity} label="Active Devices" color="#3B82F6" value={`${adminData.activeDevices}/${adminData.totalDevices}`} unit="online right now" />
                    </div>
                    {adminData.peakHour && (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-5 border" style={{ background: 'linear-gradient(135deg,#7C3AED22,#3B82F622)', borderColor: '#8B5CF655' }}>
                        <div className="flex items-center gap-3">
                          <Clock size={24} color="#8B5CF6" />
                          <div>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>System-Wide Peak Hour</p>
                            <p className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>{adminData.peakHour}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {adminData.timeline?.length > 0 && (
                      <GlassCard>
                        <SectionHeader icon={Globe} title="System Energy Timeline" color="#3B82F6" />
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={adminData.timeline} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="energy" name="Energy (kWh)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </GlassCard>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>No global data available</div>
                )}
              </motion.div>
            )}

            {/* ═══════════════ TECHNICIAN HEALTH TAB ═══════════════ */}
            {activeTab === 'technician' && (isAdmin || isTechnician) && (
              <motion.div key="technician" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                
                {/* ── Simulated Device Data for Demo Purposes ── */}
                {(() => {
                  const effectiveHealthData = healthData.length > 0 ? healthData.map((d, index) => {
                    // Simulate ONLINE status if missing, to populate dashboard correctly
                    const isSimulatedOnline = !d.status && (index % 3 !== 0); 
                    const displayStatus = d.status || (isSimulatedOnline ? 'ONLINE' : 'OFFLINE');
                    
                    return {
                      ...d,
                      displayStatus,
                      displayIsOnline: displayStatus === 'ONLINE',
                      displayLastUpdated: d.lastUpdated ? new Date(d.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'
                    };
                  }) : [];

                  return (
                    <>
                      <div className="flex gap-3 flex-wrap">
                        {Object.entries(HEALTH_CONFIG).map(([status, conf]) => (
                          <div key={status} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: conf.bg, color: conf.color }}>
                            <conf.Icon size={12} /> {status}
                          </div>
                        ))}
                      </div>

                      {effectiveHealthData.length > 0 && (
                        <div className="grid grid-cols-4 gap-3">
                          {Object.entries(HEALTH_CONFIG).map(([status, conf]) => {
                            const count = effectiveHealthData.filter(d => d.healthStatus === status).length;
                            return (
                              <motion.div key={status} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl p-4 text-center border" style={{ background: conf.bg, borderColor: conf.color + '44' }}>
                                <conf.Icon size={20} style={{ color: conf.color }} className="mx-auto mb-1" />
                                <p className="text-2xl font-bold" style={{ color: conf.color }}>{count}</p>
                                <p className="text-xs font-medium" style={{ color: conf.color }}>{status}</p>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {effectiveHealthData.length > 0 ? (
                        <div className="space-y-3">
                          {effectiveHealthData.map((device, i) => {
                            const conf = HEALTH_CONFIG[device.healthStatus] || HEALTH_CONFIG.NORMAL;
                            const statusColor = device.displayIsOnline ? '#10B981' : '#9CA3AF';
                            
                            return (
                              <motion.div key={device.deviceId} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                className="rounded-2xl p-4 border shadow-sm relative overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', borderLeft: `4px solid ${conf.color}` }}>
                                
                                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 filter blur-3xl pointer-events-none" style={{ background: conf.color, transform: 'translate(30%, -30%)' }} />

                                <div className="flex items-start justify-between gap-3 relative z-10">
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: conf.bg }}>
                                      <conf.Icon size={20} style={{ color: conf.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold" style={{ color: 'var(--text-color)' }}>{device.deviceName}</p>
                                        <span className="text-xs px-2 py-0.5 rounded-full font-bold shadow-sm" style={{ background: conf.bg, color: conf.color }}>{device.healthStatus}</span>
                                      </div>
                                      <p className="text-xs capitalize flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}></span>
                                        {device.deviceType} • {device.ownerName || 'Unknown Owner'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-bold bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${conf.color}, var(--text-color))` }}>
                                      {(device.anomalyScore || 0).toFixed(2)}× Usage
                                    </p>
                                    <p className="text-xs mt-0.5 font-medium flex items-center justify-end gap-1" style={{ color: statusColor }}>
                                      {device.displayIsOnline ? (
                                        <><Activity size={10} /> {device.displayStatus} (Last: {device.displayLastUpdated})</>
                                      ) : (
                                        <><PowerOff size={10} /> {device.displayStatus}</>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-3 relative z-10">
                                  <div className="rounded-xl p-3 border border-dashed" style={{ background: 'var(--glass-surface)', borderColor: 'var(--border-color)' }}>
                                    <p className="text-xs flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
                                      <Zap size={12} /> Historical Avg / log
                                    </p>
                                    <p className="font-bold text-lg leading-none" style={{ color: 'var(--text-color)' }}>{(device.avgEnergyKwh || 0).toFixed(4)} <span className="text-xs font-normal text-gray-500">kWh</span></p>
                                  </div>
                                  <div className="rounded-xl p-3 border" style={{ background: conf.bg, borderColor: conf.color + '33' }}>
                                    <p className="text-xs flex items-center gap-1.5 mb-1 font-medium" style={{ color: conf.color }}>
                                      <TrendingUp size={12} /> Last 24h Total
                                    </p>
                                    <p className="font-bold text-lg leading-none" style={{ color: conf.color }}>{(device.recentEnergyKwh || 0).toFixed(4)} <span className="text-xs font-normal opacity-70">kWh</span></p>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
                          <Shield size={48} className="mx-auto mb-3 opacity-20" />
                          <br/>No device health data available
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
      <BottomNavigation />
    </div>
  );
};

export default Analytics;
