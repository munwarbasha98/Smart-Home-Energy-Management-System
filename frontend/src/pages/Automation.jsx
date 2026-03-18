import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { deviceApi, automationApi } from '../services/api';
import {
    Clock, Plus, Trash2, Edit2, Loader, AlertCircle, CheckCircle2,
    Zap, Calendar, Power, ChevronDown, X, Save
} from 'lucide-react';

const GlassCard = ({ children, className = '', style = {}, ...props }) => (
    <div className={`rounded-2xl border relative overflow-hidden ${className}`}
        style={{
            background: 'var(--glass-surface)', backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)', borderColor: 'var(--glass-border)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.15)', ...style
        }} {...props}>
        <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, var(--accent-glow), transparent)' }} />
        {children}
    </div>
);

const StatusBadge = ({ executed }) => (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
        style={{
            background: executed ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
            color: executed ? '#10B981' : '#F59E0B',
            border: `1px solid ${executed ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`
        }}>
        {executed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
        {executed ? 'Executed' : 'Pending'}
    </span>
);

const ActionBadge = ({ action }) => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black"
        style={{
            background: action === 'ON' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            color: action === 'ON' ? '#22C55E' : '#EF4444',
        }}>
        <Power size={10} /> {action}
    </span>
);

function formatDateTime(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toLocalInputValue(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Schedule Form Modal ───────────────────────────────────────────────────────
const ScheduleModal = ({ isOpen, onClose, onSave, devices, editSchedule, isLoading }) => {
    const [form, setForm] = useState({
        deviceId: '', action: 'ON', scheduledAt: '', label: ''
    });
    const [formError, setFormError] = useState('');

    useEffect(() => {
        if (editSchedule) {
            setForm({
                deviceId: String(editSchedule.deviceId),
                action: editSchedule.action,
                scheduledAt: toLocalInputValue(editSchedule.scheduledAt),
                label: editSchedule.label || ''
            });
        } else {
            // Default: 5 minutes from now
            const soon = new Date(Date.now() + 5 * 60000);
            setForm({ deviceId: devices[0]?.id ? String(devices[0].id) : '', action: 'ON', scheduledAt: toLocalInputValue(soon), label: '' });
        }
        setFormError('');
    }, [editSchedule, isOpen, devices]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError('');
        if (!form.deviceId) return setFormError('Please select a device');
        if (!form.scheduledAt) return setFormError('Please set a scheduled time');
        onSave({
            deviceId: Number(form.deviceId),
            action: form.action,
            scheduledAt: new Date(form.scheduledAt).toISOString().replace('Z', ''),
            label: form.label || undefined
        });
    };

    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-md">
                    <GlassCard className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-black flex items-center gap-2" style={{ color: 'var(--text-color)' }}>
                                <Calendar size={18} style={{ color: '#10B981' }} />
                                {editSchedule ? 'Edit Schedule' : 'Add Schedule'}
                            </h2>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                style={{ color: 'var(--text-secondary)' }}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Device selector */}
                            <div>
                                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}>Device</label>
                                <div className="relative">
                                    <select
                                        value={form.deviceId}
                                        onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold appearance-none pr-8"
                                        style={{
                                            background: 'var(--glass-surface)', border: '1px solid var(--glass-border)',
                                            color: 'var(--text-color)', outline: 'none'
                                        }}>
                                        <option value="" disabled>Select a device...</option>
                                        {devices.map(d => (
                                            <option key={d.id} value={d.id} style={{ background: 'var(--card-bg)' }}>
                                                {d.name} ({d.type?.replace(/_/g, ' ')})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ color: 'var(--text-secondary)' }} />
                                </div>
                            </div>

                            {/* Action */}
                            <div>
                                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}>Action</label>
                                <div className="flex gap-3">
                                    {['ON', 'OFF'].map(act => (
                                        <button key={act} type="button"
                                            onClick={() => setForm(f => ({ ...f, action: act }))}
                                            className="flex-1 py-2.5 rounded-xl font-black text-sm border transition-all"
                                            style={{
                                                background: form.action === act
                                                    ? (act === 'ON' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)')
                                                    : 'transparent',
                                                borderColor: form.action === act
                                                    ? (act === 'ON' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)')
                                                    : 'var(--glass-border)',
                                                color: form.action === act
                                                    ? (act === 'ON' ? '#22C55E' : '#EF4444')
                                                    : 'var(--text-secondary)'
                                            }}>
                                            <Power size={13} className="inline mb-0.5 mr-1" /> {act}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scheduled time */}
                            <div>
                                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}>Scheduled Time</label>
                                <input type="datetime-local"
                                    value={form.scheduledAt}
                                    onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold"
                                    style={{
                                        background: 'var(--glass-surface)', border: '1px solid var(--glass-border)',
                                        color: 'var(--text-color)', outline: 'none'
                                    }} />
                            </div>

                            {/* Label */}
                            <div>
                                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                                    style={{ color: 'var(--text-secondary)' }}>Label (optional)</label>
                                <input type="text" placeholder="e.g. Night AC off"
                                    value={form.label}
                                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                                    className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold"
                                    style={{
                                        background: 'var(--glass-surface)', border: '1px solid var(--glass-border)',
                                        color: 'var(--text-color)', outline: 'none'
                                    }} />
                            </div>

                            {formError && (
                                <p className="text-xs font-semibold text-red-400 flex items-center gap-1">
                                    <AlertCircle size={13} /> {formError}
                                </p>
                            )}

                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={onClose}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors"
                                    style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
                                    Cancel
                                </button>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    type="submit" disabled={isLoading}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2"
                                    style={{ background: 'linear-gradient(135deg, #10B981, #22C55E)' }}>
                                    {isLoading ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
                                    {editSchedule ? 'Update' : 'Schedule'}
                                </motion.button>
                            </div>
                        </form>
                    </GlassCard>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ── Main Automation Page ──────────────────────────────────────────────────────
const Automation = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [schedules, setSchedules] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editSchedule, setEditSchedule] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all'); // all | pending | executed

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [schRes, devRes] = await Promise.all([
                automationApi.getSchedules(),
                deviceApi.getDevices()
            ]);
            setSchedules(Array.isArray(schRes.data) ? schRes.data : []);
            const devs = devRes.data.devices || devRes.data || [];
            setDevices(Array.isArray(devs) ? devs : []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load automation data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (formData) => {
        try {
            setIsSaving(true);
            if (editSchedule) {
                const res = await automationApi.updateSchedule(editSchedule.id, formData);
                setSchedules(prev => prev.map(s => s.id === editSchedule.id ? res.data : s));
            } else {
                const res = await automationApi.createSchedule(formData);
                setSchedules(prev => [res.data, ...prev]);
            }
            setIsModalOpen(false);
            setEditSchedule(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save schedule');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (scheduleId) => {
        if (!window.confirm('Delete this schedule?')) return;
        try {
            setDeletingId(scheduleId);
            await automationApi.deleteSchedule(scheduleId);
            setSchedules(prev => prev.filter(s => s.id !== scheduleId));
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete schedule');
        } finally {
            setDeletingId(null);
        }
    };

    const openEdit = (s) => { setEditSchedule(s); setIsModalOpen(true); };
    const openAdd = () => { setEditSchedule(null); setIsModalOpen(true); };

    const filtered = schedules.filter(s => {
        if (filterStatus === 'pending') return !s.executed;
        if (filterStatus === 'executed') return s.executed;
        return true;
    });

    const pendingCount = schedules.filter(s => !s.executed).length;

    return (
        <div className="min-h-screen p-4 md:p-8"
            style={{
                background: 'linear-gradient(135deg, var(--page-bg-from) 0%, var(--page-bg-mid) 30%, var(--page-bg-from) 70%, var(--page-bg-to) 100%)',
                color: 'var(--text-color)'
            }}>
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight"
                            style={{ color: 'var(--text-color)' }}>
                            ⏰ Device <span style={{ color: '#10B981' }}>Automation</span>
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                            Schedule automatic ON/OFF commands for your devices.
                        </p>
                    </div>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={openAdd}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #10B981, #22C55E)', boxShadow: '0 4px 20px rgba(16,185,129,0.35)' }}>
                        <Plus size={18} /> Add Schedule
                    </motion.button>
                </motion.header>

                {/* Summary row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                        { label: 'Total Schedules', val: schedules.length, color: '#A78BFA' },
                        { label: 'Pending', val: pendingCount, color: '#F59E0B' },
                        { label: 'Executed', val: schedules.length - pendingCount, color: '#10B981' },
                    ].map(c => (
                        <GlassCard key={c.label} className="p-4 text-center">
                            <div className="text-2xl font-black" style={{ color: c.color }}>{c.val}</div>
                            <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.label}</div>
                        </GlassCard>
                    ))}
                </div>

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="p-4 rounded-2xl border flex items-center gap-3"
                            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}>
                            <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                            <span className="text-sm font-semibold text-red-400">{error}</span>
                            <button onClick={() => setError('')} className="ml-auto text-red-400 text-xs font-bold">✕</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Schedules table */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <GlassCard className="p-6">
                        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                            <h2 className="text-base font-black flex items-center gap-2" style={{ color: 'var(--text-color)' }}>
                                <Zap size={16} style={{ color: '#10B981' }} /> Scheduled Tasks
                            </h2>
                            {/* Filter tabs */}
                            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--glass-border)' }}>
                                {['all', 'pending', 'executed'].map(f => (
                                    <button key={f} onClick={() => setFilterStatus(f)}
                                        className="px-3 py-1.5 text-xs font-bold capitalize transition-all"
                                        style={{
                                            background: filterStatus === f ? 'rgba(16,185,129,0.15)' : 'transparent',
                                            color: filterStatus === f ? '#10B981' : 'var(--text-secondary)',
                                            borderRight: f !== 'executed' ? '1px solid var(--glass-border)' : 'none'
                                        }}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                    <Loader size={32} style={{ color: '#10B981' }} />
                                </motion.div>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-5xl mb-3">📅</div>
                                <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-color)' }}>
                                    {filterStatus === 'all' ? 'No schedules yet' : `No ${filterStatus} schedules`}
                                </h3>
                                <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                                    Click "Add Schedule" to automate a device.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <AnimatePresence>
                                    {filtered.map((s, idx) => (
                                        <motion.div key={s.id} layout
                                            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -16 }} transition={{ delay: idx * 0.04 }}
                                            className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border group transition-all"
                                            style={{
                                                background: s.executed ? 'rgba(16,185,129,0.04)' : 'rgba(245,158,11,0.04)',
                                                borderColor: s.executed ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'
                                            }}>
                                            {/* Device info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-black text-sm" style={{ color: 'var(--text-color)' }}>
                                                        {s.deviceName}
                                                    </span>
                                                    <ActionBadge action={s.action} />
                                                    <StatusBadge executed={s.executed} />
                                                </div>
                                                {s.label && (
                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                                        {s.label}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    <Calendar size={11} />
                                                    <span>{formatDateTime(s.scheduledAt)}</span>
                                                    {s.executedAt && (
                                                        <span className="ml-2 text-green-400">
                                                            ✓ Ran at {formatDateTime(s.executedAt)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            {!s.executed && (
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity flex-shrink-0">
                                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                        onClick={() => openEdit(s)}
                                                        className="p-1.5 rounded-lg" style={{ color: '#60A5FA' }}
                                                        title="Edit schedule">
                                                        <Edit2 size={14} />
                                                    </motion.button>
                                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                        onClick={() => handleDelete(s.id)}
                                                        disabled={deletingId === s.id}
                                                        className="p-1.5 rounded-lg" style={{ color: '#EF4444' }}
                                                        title="Delete schedule">
                                                        {deletingId === s.id
                                                            ? <Loader size={14} className="animate-spin" />
                                                            : <Trash2 size={14} />}
                                                    </motion.button>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </GlassCard>
                </motion.div>

                {/* Info tip */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    <GlassCard className="p-4" style={{ borderColor: 'rgba(16,185,129,0.15)' }}>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <span className="font-black" style={{ color: '#10B981' }}>⚡ How it works: </span>
                            Schedules are checked every minute by the backend scheduler. When the scheduled time arrives, the device command is automatically executed. Executed schedules are kept for your records.
                        </p>
                    </GlassCard>
                </motion.div>
            </div>

            {/* Modal */}
            <ScheduleModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditSchedule(null); }}
                onSave={handleSave}
                devices={devices}
                editSchedule={editSchedule}
                isLoading={isSaving}
            />
        </div>
    );
};

export default Automation;
