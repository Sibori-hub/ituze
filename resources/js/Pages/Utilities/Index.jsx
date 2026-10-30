import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmActionModal from '@/Components/ConfirmActionModal';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { Head, router, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Eye, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, Droplets, Leaf, Lightbulb, Minus,
    Plus, Receipt, Trash2, Truck, Wallet, X, Zap,
} from 'lucide-react';
import { useTranslation } from '@/localization';

const localeFor = language => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const inputClass = 'mt-1 block w-full rounded-xl border-gray-300 dark:border-slate-600 text-sm shadow-sm focus:border-[#0E3B2E] focus:ring-[#0E3B2E]';
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TYPE_ICON = { water: Droplets, electricity: Zap };
const GRADE_TONE = {
    A: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30',
    B: 'bg-lime-50 dark:bg-lime-500/10 text-lime-800 dark:text-lime-300 ring-lime-200 dark:ring-lime-500/30',
    C: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30',
    D: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/30',
};

function Change({ value, t }) {
    if (value === null || value === undefined) {
        return <span className="text-xs text-gray-500 dark:text-slate-400">{t('No previous month to compare')}</span>;
    }
    // Using less is good: falling usage is shown in green.
    const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
    const tone = value > 0 ? 'text-red-700 dark:text-red-300' : value < 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-slate-300';

    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
            <Icon size={14} aria-hidden="true" />
            {value > 0 ? t(':value% more than last month', { value }) : value < 0 ? t(':value% less than last month', { value: Math.abs(value) }) : t('Same as last month')}
        </span>
    );
}

/** Waste taken in the chosen month: ibibora and ibitabora in kg, per building and over 6 months. */
function WasteMonth({ trends, comparison, byBuilding, month, monthLabel, number, money, t }) {
    const bio = comparison.waste_bio_kg?.current || 0;
    const other = comparison.waste_other_kg?.current || 0;
    const total = bio + other;
    const bioShare = total > 0 ? Math.round((bio / total) * 100) : 0;
    const lastSix = trends.slice(-6);

    return (
        <div className="mt-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/10 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('Waste taken in :month', { month })}</h3>
                <span className="text-xs text-gray-600 dark:text-slate-300">{t('Last month: :value', { value: `${number(comparison.waste_kg?.previous)} kg` })} · <Change value={comparison.waste_kg?.change} t={t} /></span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 ring-1 ring-emerald-200 dark:ring-emerald-500/30">
                    <p className="font-[Sora] text-lg font-bold tabular-nums text-emerald-900 dark:text-emerald-300">{number(bio)} kg</p>
                    <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">{t('Ibibora')}</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 ring-1 ring-sky-200 dark:ring-sky-500/30">
                    <p className="font-[Sora] text-lg font-bold tabular-nums text-sky-900 dark:text-sky-300">{number(other)} kg</p>
                    <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">{t('Ibitabora')}</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-slate-900 p-3 ring-1 ring-gray-200 dark:ring-slate-700">
                    <p className="font-[Sora] text-lg font-bold tabular-nums text-gray-900 dark:text-slate-100">{number(total)} kg</p>
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-slate-200">{t('Total')}</p>
                </div>
            </div>
            {total > 0 && (
                <div className="mt-3">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-sky-200 dark:bg-sky-500/25" role="img" aria-label={t(':share% biodegradable', { share: bioShare })}>
                        <div className="h-full bg-emerald-600" style={{ width: `${bioShare}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">{t(':share% biodegradable (ibibora), :rest% non-biodegradable (ibitabora)', { share: bioShare, rest: 100 - bioShare })}</p>
                </div>
            )}

            {byBuilding.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <caption className="sr-only">{t('Waste per building')}</caption>
                        <thead>
                            <tr className="text-gray-600 dark:text-slate-300">
                                <th scope="col" className="py-1.5 pr-2 font-semibold">{t('Building')}</th>
                                <th scope="col" className="px-2 py-1.5 text-right font-semibold">{t('Collections')}</th>
                                <th scope="col" className="px-2 py-1.5 text-right font-semibold">{t('Ibibora')}</th>
                                <th scope="col" className="px-2 py-1.5 text-right font-semibold">{t('Ibitabora')}</th>
                                <th scope="col" className="px-2 py-1.5 text-right font-semibold">{t('Total')}</th>
                                <th scope="col" className="py-1.5 pl-2 text-right font-semibold">{t('Paid')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-100 dark:divide-emerald-500/20">
                            {byBuilding.map((row) => (
                                <tr key={row.property.id} className="text-gray-800 dark:text-slate-100">
                                    <th scope="row" className="py-1.5 pr-2 font-medium">{row.property.name}</th>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{row.collections}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{number(row.bio_kg)} kg</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{number(row.other_kg)} kg</td>
                                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{number(row.total_kg)} kg</td>
                                    <td className="py-1.5 pl-2 text-right tabular-nums">{money(row.cost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-4">
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">{t('Last 6 months')}</p>
                <ul className="mt-1.5 grid grid-cols-6 gap-1.5">
                    {lastSix.map((row) => {
                        const max = Math.max(1, ...lastSix.map((item) => item.waste_kg || 0));
                        return (
                            <li key={row.month} className="text-center">
                                <div className="mx-auto flex h-16 w-full max-w-[2.5rem] flex-col justify-end overflow-hidden rounded-md bg-white dark:bg-slate-900 ring-1 ring-gray-200 dark:ring-slate-700" title={`${number(row.waste_bio_kg)} kg ibibora · ${number(row.waste_other_kg)} kg ibitabora`}>
                                    <div className="bg-sky-400" style={{ height: `${((row.waste_other_kg || 0) / max) * 100}%` }} />
                                    <div className="bg-emerald-600" style={{ height: `${((row.waste_bio_kg || 0) / max) * 100}%` }} />
                                </div>
                                <p className="mt-1 text-[10px] text-gray-600 dark:text-slate-300">{monthLabel(row.month)}</p>
                                <p className="text-[10px] font-semibold tabular-nums text-gray-800 dark:text-slate-100">{number(row.waste_kg)}</p>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

function SummaryCard({ icon: Icon, label, value, previous, change, tone, t }) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300">{label}</p>
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ring-1 ${tone}`} aria-hidden="true"><Icon size={17} /></span>
            </div>
            <p className="mt-3 break-words font-[Sora] text-xl font-bold tabular-nums text-gray-900 dark:text-slate-100 sm:text-2xl">{value}</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">{t('Last month: :value', { value: previous })}</p>
            <div className="mt-1"><Change value={change} t={t} /></div>
        </div>
    );
}

function TrendChart({ trends, view, monthLabel, money, number, units, t }) {
    const series = view === 'costs'
        ? [
            { key: 'water_cost', label: t('Water'), color: '#0284c7' },
            { key: 'electricity_cost', label: t('Electricity'), color: '#f59e0b' },
            { key: 'waste_cost', label: t('Waste'), color: '#0E3B2E' },
        ]
        : [{ key: view, label: view === 'water' ? t('Water (:unit)', { unit: units.water }) : t('Electricity (:unit)', { unit: units.electricity }), color: view === 'water' ? '#0284c7' : '#f59e0b' }];
    const totals = trends.map(month => series.reduce((sum, item) => sum + Number(month[item.key] || 0), 0));
    const max = Math.max(1, ...totals);
    const short = value => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`;
    const format = value => view === 'costs' ? money(value) : `${number(value)} ${units[view]}`;
    const empty = totals.every(total => total === 0);

    return (
        <div className="overflow-x-auto px-3 pb-4 pt-5 sm:px-6">
            {empty && <p className="mb-2 text-sm text-gray-600 dark:text-slate-300">{t('Nothing recorded in these 12 months yet.')}</p>}
            <svg viewBox="0 0 960 260" role="img" aria-label={series.map(item => item.label).join(', ')} className="h-60 w-full min-w-[640px]">
                {[0, 0.25, 0.5, 0.75, 1].map(step => (
                    <g key={step}>
                        <line x1="56" x2="950" y1={220 - step * 190} y2={220 - step * 190} stroke="#e5e7eb" strokeDasharray={step ? '4 5' : undefined} />
                        <text x="48" y={224 - step * 190} textAnchor="end" fontSize="10" fill="#6b7280">{short(max * step)}</text>
                    </g>
                ))}
                {trends.map((month, index) => {
                    const x = 76 + index * 74;
                    let top = 220;

                    return (
                        <g key={month.month}>
                            {series.map(item => {
                                const height = (Number(month[item.key] || 0) / max) * 190;
                                top -= height;

                                return (
                                    <rect key={item.key} x={x} y={top} width="40" height={height} rx={series.length > 1 ? 2 : 5} fill={item.color}>
                                        <title>{`${monthLabel(month.month, 'long')} — ${item.label}: ${format(month[item.key])}`}</title>
                                    </rect>
                                );
                            })}
                            <text x={x + 20} y="242" textAnchor="middle" fontSize="11" fill="#4b5563">{monthLabel(month.month)}</text>
                        </g>
                    );
                })}
            </svg>
            <div className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-gray-700 dark:text-slate-200">
                {series.map(item => (
                    <span key={item.key} className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />{item.label}</span>
                ))}
            </div>
            {/* The same figures as a table, for screen readers and exact values. */}
            <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-[#0E3B2E] dark:text-emerald-300">{t('Show the figures')}</summary>
                <table className="mt-2 w-full min-w-[480px] text-left text-sm">
                    <thead><tr className="text-xs text-gray-600 dark:text-slate-300"><th className="py-1 pr-3">{t('Month')}</th>{series.map(item => <th key={item.key} className="py-1 pr-3">{item.label}</th>)}</tr></thead>
                    <tbody>
                        {trends.map(month => (
                            <tr key={month.month} className="border-t border-gray-100 dark:border-slate-800">
                                <td className="py-1 pr-3">{monthLabel(month.month, 'long')}</td>
                                {series.map(item => <td key={item.key} className="py-1 pr-3 tabular-nums">{format(month[item.key])}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}

function ReadingForm({ show, onClose, properties, latest, units, defaultPropertyId, defaultType, t }) {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const form = useForm({
        property_id: defaultPropertyId || properties[0]?.id || '',
        type: defaultType || 'water',
        month: thisMonth,
        reading: '',
        meter_replaced: false,
        consumption: '',
        cost: '',
        bill_reference: '',
        notes: '',
    });
    const last = latest.filter(item => Number(item.property_id) === Number(form.data.property_id) && item.type === form.data.type && item.month < form.data.month)
        .sort((a, b) => b.month.localeCompare(a.month))[0];
    const unit = units[form.data.type];
    const used = last && !form.data.meter_replaced && form.data.reading !== '' ? Number(form.data.reading) - last.reading : null;

    const submit = event => {
        event.preventDefault();
        form.post(route('utilities.readings.store'), { preserveScroll: true, onSuccess: () => { form.reset('reading', 'consumption', 'cost', 'bill_reference', 'notes', 'meter_replaced'); onClose(); } });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="p-6" noValidate>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{t('Record a meter reading')}</h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Read the meter once a month. Add the bill if you have it.')}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40" aria-label={t('Close')}><X size={18} /></button>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label htmlFor="reading-property" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Building')}</label>
                        <select id="reading-property" className={inputClass} value={form.data.property_id} onChange={event => form.setData('property_id', event.target.value)}>
                            {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                        </select>
                        <InputError message={form.errors.property_id} className="mt-1" />
                    </div>
                    <fieldset className="sm:col-span-2">
                        <legend className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Meter')}</legend>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                            {['water', 'electricity'].map(type => {
                                const Icon = TYPE_ICON[type];
                                const selected = form.data.type === type;

                                return (
                                    <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold focus-within:ring-2 focus-within:ring-[#0E3B2E]/40 ${selected ? 'border-[#0E3B2E] dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-[#0E3B2E] dark:text-emerald-300' : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200'}`}>
                                        <input type="radio" name="type" value={type} checked={selected} onChange={() => form.setData('type', type)} className="sr-only" />
                                        <Icon size={16} aria-hidden="true" />{type === 'water' ? t('Water') : t('Electricity')}
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                    <div>
                        <label htmlFor="reading-month" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Month')}</label>
                        <input id="reading-month" type="month" max={thisMonth} className={inputClass} value={form.data.month} onChange={event => form.setData('month', event.target.value)} />
                        <InputError message={form.errors.month} className="mt-1" />
                    </div>
                    <div>
                        <label htmlFor="reading-value" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Meter reading (:unit)', { unit })}</label>
                        <input id="reading-value" type="number" inputMode="decimal" min="0" step="0.01" className={inputClass} value={form.data.reading} onChange={event => form.setData('reading', event.target.value)} aria-describedby="reading-hint" required />
                        <p id="reading-hint" className="mt-1 text-xs text-gray-600 dark:text-slate-300">
                            {last ? t('Last reading: :value (:month)', { value: last.reading, month: last.month }) : t('First reading for this meter: usage starts next month.')}
                        </p>
                        {used !== null && used >= 0 && <p className="mt-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">{t('Used this month: :value :unit', { value: Math.round(used * 100) / 100, unit })}</p>}
                        <InputError message={form.errors.reading} className="mt-1" />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-slate-100">
                            <input type="checkbox" checked={form.data.meter_replaced} onChange={event => form.setData('meter_replaced', event.target.checked)} className="mt-0.5 rounded border-gray-300 dark:border-slate-600 text-[#0E3B2E] dark:text-emerald-300 focus:ring-[#0E3B2E]" />
                            <span>{t('Meter replaced this month (the new meter starts again from a low number)')}</span>
                        </label>
                    </div>
                    {(form.data.meter_replaced || !last) && (
                        <div className="sm:col-span-2">
                            <label htmlFor="reading-consumption" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Used this month (:unit)', { unit })}{!last && !form.data.meter_replaced ? ` · ${t('optional')}` : ''}</label>
                            <input id="reading-consumption" type="number" inputMode="decimal" min="0" step="0.01" className={inputClass} value={form.data.consumption} onChange={event => form.setData('consumption', event.target.value)} />
                            <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">{t('Take it from the bill if you have one.')}</p>
                            <InputError message={form.errors.consumption} className="mt-1" />
                        </div>
                    )}
                    <div>
                        <label htmlFor="reading-cost" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Bill amount (RWF)')} · {t('optional')}</label>
                        <input id="reading-cost" type="number" inputMode="numeric" min="0" step="1" className={inputClass} value={form.data.cost} onChange={event => form.setData('cost', event.target.value)} />
                        <InputError message={form.errors.cost} className="mt-1" />
                    </div>
                    <div>
                        <label htmlFor="reading-bill" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Bill or token number')} · {t('optional')}</label>
                        <input id="reading-bill" type="text" maxLength={80} className={inputClass} value={form.data.bill_reference} onChange={event => form.setData('bill_reference', event.target.value)} />
                        <InputError message={form.errors.bill_reference} className="mt-1" />
                    </div>
                    <div className="sm:col-span-2">
                        <label htmlFor="reading-notes" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Notes')} · {t('optional')}</label>
                        <textarea id="reading-notes" rows={2} maxLength={500} className={inputClass} value={form.data.notes} onChange={event => form.setData('notes', event.target.value)} />
                    </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">{t('Cancel')}</button>
                    <button type="submit" disabled={form.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#145240] disabled:opacity-60">{form.processing ? t('Saving…') : t('Save reading')}</button>
                </div>
            </form>
        </Modal>
    );
}

function ScheduleForm({ show, onClose, properties, defaultPropertyId, t }) {
    const form = useForm({
        property_id: defaultPropertyId || properties[0]?.id || '',
        collector: '',
        frequency: 'weekly',
        day: 1,
        cost_per_collection: '',
        starts_on: new Date().toISOString().slice(0, 10),
    });
    const submit = event => {
        event.preventDefault();
        form.post(route('utilities.schedules.store'), { preserveScroll: true, onSuccess: () => { form.reset(); onClose(); } });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} className="p-6" noValidate>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{t('Waste collection schedule')}</h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Who collects the waste, how often and what it costs. A new schedule replaces the old one.')}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40" aria-label={t('Close')}><X size={18} /></button>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label htmlFor="schedule-property" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Building')}</label>
                        <select id="schedule-property" className={inputClass} value={form.data.property_id} onChange={event => form.setData('property_id', event.target.value)}>
                            {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                        </select>
                        <InputError message={form.errors.property_id} className="mt-1" />
                    </div>
                    <div className="sm:col-span-2">
                        <label htmlFor="schedule-collector" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Collector (company or person)')}</label>
                        <input id="schedule-collector" type="text" maxLength={120} className={inputClass} value={form.data.collector} onChange={event => form.setData('collector', event.target.value)} required />
                        <InputError message={form.errors.collector} className="mt-1" />
                    </div>
                    <div>
                        <label htmlFor="schedule-frequency" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('How often')}</label>
                        <select id="schedule-frequency" className={inputClass} value={form.data.frequency} onChange={event => { form.setData(data => ({ ...data, frequency: event.target.value, day: 1 })); }}>
                            <option value="weekly">{t('Every week')}</option>
                            <option value="biweekly">{t('Every two weeks')}</option>
                            <option value="monthly">{t('Every month')}</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="schedule-day" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{form.data.frequency === 'monthly' ? t('Day of the month') : t('Day of the week')}</label>
                        <select id="schedule-day" className={inputClass} value={form.data.day} onChange={event => form.setData('day', Number(event.target.value))}>
                            {form.data.frequency === 'monthly'
                                ? Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)
                                : WEEKDAYS.map((day, index) => <option key={day} value={index + 1}>{t(day)}</option>)}
                        </select>
                        <InputError message={form.errors.day} className="mt-1" />
                    </div>
                    <div>
                        <label htmlFor="schedule-cost" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Cost per collection (RWF)')}</label>
                        <input id="schedule-cost" type="number" inputMode="numeric" min="0" step="1" className={inputClass} value={form.data.cost_per_collection} onChange={event => form.setData('cost_per_collection', event.target.value)} required />
                        <InputError message={form.errors.cost_per_collection} className="mt-1" />
                    </div>
                    <div>
                        <label htmlFor="schedule-start" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Starts on')}</label>
                        <input id="schedule-start" type="date" className={inputClass} value={form.data.starts_on} onChange={event => form.setData('starts_on', event.target.value)} required />
                        <InputError message={form.errors.starts_on} className="mt-1" />
                    </div>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">{t('Cancel')}</button>
                    <button type="submit" disabled={form.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#145240] disabled:opacity-60">{form.processing ? t('Saving…') : t('Save schedule')}</button>
                </div>
            </form>
        </Modal>
    );
}

function CollectionForm({ item, onClose, money, formatDate, t }) {
    const form = useForm({
        property_id: item?.property.id || '',
        waste_schedule_id: item?.schedule_id || null,
        scheduled_on: item?.date || '',
        status: 'collected',
        cost: item?.cost ?? '',
        notes: '',
        // Bins taken; filled in from the last collection, which is usually the same.
        biodegradable_bins: item?.last_bins?.biodegradable_bins ?? '',
        biodegradable_bin_kg: item?.last_bins?.biodegradable_bin_kg ?? 50,
        non_biodegradable_bins: item?.last_bins?.non_biodegradable_bins ?? '',
        non_biodegradable_bin_kg: item?.last_bins?.non_biodegradable_bin_kg ?? 50,
    });
    const kgOf = (bins, size) => (Number(bins) || 0) * (Number(size) || 0);
    const bioKg = kgOf(form.data.biodegradable_bins, form.data.biodegradable_bin_kg);
    const otherKg = kgOf(form.data.non_biodegradable_bins, form.data.non_biodegradable_bin_kg);
    const submit = event => {
        event.preventDefault();
        form.post(route('utilities.collections.store'), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Modal show={Boolean(item)} onClose={onClose} maxWidth="md">
            {item && (
                <form onSubmit={submit} className="p-6" noValidate>
                    <h2 className="font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{t('Waste collection of :date', { date: formatDate(item.date) })}</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{item.property.name} · {item.collector}</p>
                    <fieldset className="mt-5">
                        <legend className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Was the waste collected?')}</legend>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                            {[['collected', t('Collected')], ['missed', t('Missed')]].map(([value, label]) => (
                                <label key={value} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold focus-within:ring-2 focus-within:ring-[#0E3B2E]/40 ${form.data.status === value ? (value === 'collected' ? 'border-[#0E3B2E] dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-[#0E3B2E] dark:text-emerald-300' : 'border-red-400 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300') : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200'}`}>
                                    <input type="radio" name="status" value={value} checked={form.data.status === value} onChange={() => form.setData('status', value)} className="sr-only" />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    {form.data.status === 'collected' && (
                        <fieldset className="mt-4">
                            <legend className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Bins taken')}</legend>
                            <div className="mt-2 space-y-2">
                                {[
                                    ['biodegradable', t('Biodegradable (ibibora)'), t('Food, peelings, leaves, garden waste'), 'bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-200 dark:ring-emerald-500/30 text-emerald-900 dark:text-emerald-300', bioKg],
                                    ['non_biodegradable', t('Non-biodegradable (ibitabora)'), t('Plastic, glass, metal, nylon'), 'bg-sky-50 dark:bg-sky-500/10 ring-sky-200 dark:ring-sky-500/30 text-sky-900 dark:text-sky-300', otherKg],
                                ].map(([key, label, hint, tone, kg]) => (
                                    <div key={key} className={`rounded-xl p-3 ring-1 ${tone}`}>
                                        <p className="text-sm font-semibold">{label}</p>
                                        <p className="text-xs opacity-80">{hint}</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                            <label className="sr-only" htmlFor={`${key}-bins`}>{t('Number of bins')}</label>
                                            <input id={`${key}-bins`} type="number" inputMode="numeric" min="0" max="500" step="1" placeholder="0"
                                                value={form.data[`${key}_bins`]} onChange={event => form.setData(`${key}_bins`, event.target.value)}
                                                className="w-20 rounded-lg border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-center text-sm font-semibold text-gray-900 dark:text-slate-100 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]" />
                                            <span className="text-gray-700 dark:text-slate-200">{t('bins of')}</span>
                                            <label className="sr-only" htmlFor={`${key}-kg`}>{t('Size of one bin (kg)')}</label>
                                            <input id={`${key}-kg`} type="number" inputMode="decimal" min="1" max="5000" step="0.5"
                                                value={form.data[`${key}_bin_kg`]} onChange={event => form.setData(`${key}_bin_kg`, event.target.value)}
                                                className="w-20 rounded-lg border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-center text-sm font-semibold text-gray-900 dark:text-slate-100 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]" />
                                            <span className="text-gray-700 dark:text-slate-200">kg</span>
                                            <span className="ml-auto text-xs font-semibold tabular-nums">= {kg.toLocaleString()} kg</span>
                                        </div>
                                        <InputError message={form.errors[`${key}_bins`] || form.errors[`${key}_bin_kg`]} className="mt-1" />
                                    </div>
                                ))}
                            </div>
                            <p className="mt-2 text-right text-sm font-bold text-gray-900 dark:text-slate-100">{t('Total: :kg kg', { kg: (bioKg + otherKg).toLocaleString() })}</p>
                        </fieldset>
                    )}
                    {form.data.status === 'collected' && (
                        <div className="mt-4">
                            <label htmlFor="collection-cost" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Amount paid (RWF)')}</label>
                            <input id="collection-cost" type="number" inputMode="numeric" min="0" step="1" className={inputClass} value={form.data.cost} onChange={event => form.setData('cost', event.target.value)} />
                            <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">{t('Usual cost: :amount', { amount: money(item.cost) })}</p>
                            <InputError message={form.errors.cost} className="mt-1" />
                        </div>
                    )}
                    <div className="mt-4">
                        <label htmlFor="collection-notes" className="text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Notes')} · {t('optional')}</label>
                        <textarea id="collection-notes" rows={2} maxLength={500} className={inputClass} value={form.data.notes} onChange={event => form.setData('notes', event.target.value)} />
                    </div>
                    <InputError message={form.errors.scheduled_on} className="mt-2" />
                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">{t('Cancel')}</button>
                        <button type="submit" disabled={form.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#145240] disabled:opacity-60">{form.processing ? t('Saving…') : t('Save')}</button>
                    </div>
                </form>
            )}
        </Modal>
    );
}

export default function UtilitiesIndex({
    properties = [], filters = {}, canEdit: canEditAny = false, lockedPropertyIds = [], units = { water: 'm³', electricity: 'kWh' }, trends = [], comparison = {},
    alerts = [], scores = [], overallScore = null, latest = [], readings = [], schedules = [], planned = [], wasteByBuilding = [],
}) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const editable = properties.filter(property => !lockedPropertyIds.includes(property.id));
    const canEditProperty = id => canEditAny && !lockedPropertyIds.includes(Number(id));
    // Page-wide actions (add a reading, add a schedule) need at least one building the account records.
    const canEdit = canEditAny && editable.length > 0;
    const number = value => Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 2 });
    const money = value => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const monthLabel = (value, style = 'short') => new Intl.DateTimeFormat(locale, { month: style, ...(style === 'long' ? { year: 'numeric' } : {}) }).format(new Date(`${value}-01T12:00:00`));
    const formatDate = value => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
    const typeLabel = type => (type === 'water' ? t('Water') : t('Electricity'));

    const [view, setView] = useState('water');
    const [readingForm, setReadingForm] = useState(null);
    const [scheduleForm, setScheduleForm] = useState(false);
    const [collection, setCollection] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [busy, setBusy] = useState(false);

    const applyFilters = changes => router.get(route('utilities.index'), { ...filters, ...changes }, { preserveScroll: true, preserveState: true, replace: true });
    const dueCollections = useMemo(() => planned.filter(item => item.is_past && !item.status), [planned]);
    const upcoming = useMemo(() => planned.filter(item => !item.is_past).slice(0, 6), [planned]);
    const doneCollections = useMemo(() => planned.filter(item => item.status).reverse().slice(0, 8), [planned]);
    const runConfirm = () => {
        setBusy(true);
        router.delete(confirm.url, { preserveScroll: true, onFinish: () => { setBusy(false); setConfirm(null); } });
    };

    const current = trends[trends.length - 1]?.month || filters.month;
    const VIEWS = [['water', t('Water'), Droplets], ['electricity', t('Electricity'), Zap], ['costs', t('Costs'), Wallet]];

    return (
        <AuthenticatedLayout>
            <Head title={t('Utilities & environment')} />
            <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                {properties.some(property => lockedPropertyIds.includes(property.id)) && (
                    <p role="note" className="flex items-start gap-2 rounded-2xl bg-sky-50 dark:bg-sky-500/10 px-4 py-3 text-sm text-sky-950 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-500/30">
                        <Eye size={16} className="mt-0.5 flex-none" aria-hidden="true" />
                        {t('Buildings your managers run are shown read only: :names. Their manager records the water, electricity and waste.', { names: properties.filter(property => lockedPropertyIds.includes(property.id)).map(property => property.name).join(', ') })}
                    </p>
                )}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300"><Leaf size={14} aria-hidden="true" />{t('Environment')}</p>
                        <h1 className="mt-1 font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{t('Utilities & environment')}</h1>
                        <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-slate-300">{t('Water, electricity and waste for your buildings: monthly use, costs, alerts and a green score.')}</p>
                    </div>
                    {canEdit && properties.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setReadingForm({ type: view === 'electricity' ? 'electricity' : 'water' })} className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#145240] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40 focus-visible:ring-offset-2">
                                <Plus size={16} aria-hidden="true" />{t('Record reading or bill')}
                            </button>
                            <button type="button" onClick={() => setScheduleForm(true)} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40">
                                <Truck size={16} aria-hidden="true" />{t('Waste schedule')}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-3 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <div className="min-w-[200px] flex-1">
                        <label htmlFor="filter-property" className="text-xs font-semibold text-gray-700 dark:text-slate-200">{t('Building')}</label>
                        <select id="filter-property" className={inputClass} value={filters.property_id || ''} onChange={event => applyFilters({ property_id: event.target.value || undefined })}>
                            <option value="">{t('All buildings')}</option>
                            {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                        </select>
                    </div>
                    <div className="min-w-[160px]">
                        <label htmlFor="filter-month" className="text-xs font-semibold text-gray-700 dark:text-slate-200">{t('Month')}</label>
                        <input id="filter-month" type="month" className={inputClass} value={filters.month || ''} onChange={event => event.target.value && applyFilters({ month: event.target.value })} />
                    </div>
                </div>

                {properties.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-10 text-center">
                        <Leaf className="mx-auto text-emerald-700 dark:text-emerald-300" size={28} aria-hidden="true" />
                        <p className="mt-3 font-semibold text-gray-900 dark:text-slate-100">{t('No buildings yet')}</p>
                        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Add a building first, then record its water and electricity here.')}</p>
                    </div>
                ) : (
                    <>
                        <section aria-labelledby="summary-title">
                            <h2 id="summary-title" className="mb-3 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{t('Summary for :month', { month: monthLabel(current, 'long') })}</h2>
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <SummaryCard icon={Droplets} tone="bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-300 ring-sky-100 dark:ring-sky-500/30" label={t('Water used')} value={`${number(comparison.water?.current)} ${units.water}`} previous={`${number(comparison.water?.previous)} ${units.water}`} change={comparison.water?.change} t={t} />
                                <SummaryCard icon={Zap} tone="bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-100 dark:ring-amber-500/30" label={t('Electricity used')} value={`${number(comparison.electricity?.current)} ${units.electricity}`} previous={`${number(comparison.electricity?.previous)} ${units.electricity}`} change={comparison.electricity?.change} t={t} />
                                <SummaryCard icon={Receipt} tone="bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 ring-violet-100 dark:ring-violet-500/30" label={t('Utility costs')} value={money(comparison.total_cost?.current)} previous={money(comparison.total_cost?.previous)} change={comparison.total_cost?.change} t={t} />
                                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300">{t('Green score')}</p>
                                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-100 dark:ring-emerald-500/30" aria-hidden="true"><Leaf size={17} /></span>
                                    </div>
                                    <p className="mt-3 font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{overallScore === null ? '—' : `${overallScore}/100`}</p>
                                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallScore ?? 0} aria-label={t('Green score')}>
                                        <div className={`h-full rounded-full ${overallScore >= 80 ? 'bg-emerald-600' : overallScore >= 60 ? 'bg-lime-500' : overallScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${overallScore ?? 0}%` }} />
                                    </div>
                                    <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">{t('Average of your buildings')}</p>
                                </div>
                            </div>
                            <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 sm:grid-cols-3">
                                {[
                                    ['water_cost', t('Water bills')],
                                    ['electricity_cost', t('Electricity bills')],
                                    ['waste_cost', t('Waste collection')],
                                ].map(([key, label]) => (
                                    <div key={key} className="bg-white dark:bg-slate-900 px-5 py-4">
                                        <dt className="text-xs font-semibold text-gray-600 dark:text-slate-300">{label}</dt>
                                        <dd className="mt-1 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{money(comparison[key]?.current)}</dd>
                                        <dd className="text-xs text-gray-600 dark:text-slate-300">{t('Last month: :value', { value: money(comparison[key]?.previous) })}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>

                        <section aria-labelledby="trend-title" className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 dark:border-slate-800 px-5 py-4 sm:px-6">
                                <div>
                                    <h2 id="trend-title" className="font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{t('Monthly trends')}</h2>
                                    <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-300">{t('12 months ending with the chosen month')}</p>
                                </div>
                                <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1" role="group" aria-label={t('Chart')}>
                                    {VIEWS.map(([key, label, Icon]) => (
                                        <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40 ${view === key ? 'bg-white dark:bg-slate-900 text-[#0E3B2E] dark:text-emerald-300 shadow-sm' : 'text-gray-700 dark:text-slate-200 hover:text-gray-900 dark:hover:text-white'}`}>
                                            <Icon size={15} aria-hidden="true" />{label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <TrendChart trends={trends} view={view} monthLabel={monthLabel} money={money} number={number} units={units} t={t} />
                        </section>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <section aria-labelledby="alerts-title" className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
                                <h2 id="alerts-title" className="flex items-center gap-2 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100"><AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />{t('High consumption alerts')}</h2>
                                <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-300">{t('Months that used 30% or more above the average of the months before (last 6 months).')}</p>
                                {alerts.length === 0 ? (
                                    <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300"><CheckCircle2 size={16} aria-hidden="true" />{t('No unusual use. Well done.')}</p>
                                ) : (
                                    <ul className="mt-4 space-y-2">
                                        {alerts.map(alert => {
                                            const Icon = TYPE_ICON[alert.type];

                                            return (
                                                <li key={`${alert.property.id}-${alert.type}-${alert.month}`} className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
                                                    <Icon size={18} className="mt-0.5 flex-none text-amber-700 dark:text-amber-300" aria-hidden="true" />
                                                    <div className="text-sm">
                                                        <p className="font-semibold text-gray-900 dark:text-slate-100">{t(':type at :building: :percent% above average', { type: typeLabel(alert.type), building: alert.property.name, percent: alert.percent })}</p>
                                                        <p className="text-gray-700 dark:text-slate-200">{t(':month: :used :unit used, average :average :unit', { month: monthLabel(alert.month, 'long'), used: number(alert.consumption), average: number(alert.average), unit: units[alert.type] })}</p>
                                                        <p className="mt-0.5 text-xs text-gray-600 dark:text-slate-300">{alert.type === 'water' ? t('Check for leaking taps, toilets or pipes.') : t('Check for equipment left on or faulty appliances.')}</p>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>

                            <section aria-labelledby="waste-title" className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
                                <h2 id="waste-title" className="flex items-center gap-2 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100"><Truck size={18} className="text-emerald-700 dark:text-emerald-300" aria-hidden="true" />{t('Waste collection')}</h2>
                                <WasteMonth trends={trends} comparison={comparison} byBuilding={wasteByBuilding} month={monthLabel(current, 'long')} monthLabel={monthLabel} number={number} money={money} t={t} />
                                {schedules.length === 0 ? (
                                    <p className="mt-3 text-sm text-gray-600 dark:text-slate-300">{canEdit ? t('No schedule yet. Add who collects the waste and how often.') : t('No waste collection schedule yet.')}</p>
                                ) : (
                                    <ul className="mt-3 space-y-2">
                                        {schedules.map(schedule => (
                                            <li key={schedule.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 px-4 py-3 text-sm">
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-slate-100">{schedule.property.name} · {schedule.collector}</p>
                                                    <p className="text-gray-700 dark:text-slate-200">
                                                        {schedule.frequency === 'monthly'
                                                            ? t('Every month on day :day', { day: schedule.day })
                                                            : t(schedule.frequency === 'weekly' ? 'Every :day' : 'Every other :day', { day: t(WEEKDAYS[schedule.day - 1]) })}
                                                        {' · '}{money(schedule.cost)}
                                                    </p>
                                                </div>
                                                {canEditProperty(schedule.property.id) && (
                                                    <button type="button" onClick={() => setConfirm({ url: route('utilities.schedules.destroy', schedule.id), title: t('Stop this schedule?'), message: t('Past collections stay recorded.') })} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300">{t('Stop')}</button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {dueCollections.length > 0 && (
                                    <div className="mt-4">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('To confirm')}</h3>
                                        <ul className="mt-2 divide-y divide-gray-100 dark:divide-slate-800">
                                            {dueCollections.map(item => (
                                                <li key={`${item.property.id}-${item.date}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                                                    <span><span className="font-medium text-gray-900 dark:text-slate-100">{formatDate(item.date)}</span> · <span className="text-gray-700 dark:text-slate-200">{item.property.name}</span></span>
                                                    {canEditProperty(item.property.id) ? (
                                                        <button type="button" onClick={() => setCollection(item)} className="rounded-lg border border-[#0E3B2E]/30 dark:border-emerald-400/30 px-3 py-1 text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40">{t('Mark collected or missed')}</button>
                                                    ) : <span className="text-xs text-gray-600 dark:text-slate-300">{t('Not confirmed')}</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {upcoming.length > 0 && (
                                    <div className="mt-4">
                                        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-slate-100"><CalendarClock size={15} aria-hidden="true" />{t('Next collections')}</h3>
                                        <ul className="mt-2 flex flex-wrap gap-2">
                                            {upcoming.map(item => (
                                                <li key={`${item.property.id}-${item.date}`} className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:text-emerald-300">{formatDate(item.date)}{properties.length > 1 && !filters.property_id ? ` · ${item.property.name}` : ''}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {doneCollections.length > 0 && (
                                    <div className="mt-4">
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('Recorded collections')}</h3>
                                        <ul className="mt-2 divide-y divide-gray-100 dark:divide-slate-800">
                                            {doneCollections.map(item => (
                                                <li key={`${item.property.id}-${item.date}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                                                    <span className="min-w-0 text-gray-800 dark:text-slate-100">
                                                        {formatDate(item.date)} · {item.property.name}
                                                        {item.bins && item.bins.total_kg > 0 && (
                                                            <span className="block text-xs text-gray-600 dark:text-slate-300">
                                                                {[
                                                                    item.bins.biodegradable_bins ? t(':count × :kg kg ibibora', { count: item.bins.biodegradable_bins, kg: item.bins.biodegradable_bin_kg }) : null,
                                                                    item.bins.non_biodegradable_bins ? t(':count × :kg kg ibitabora', { count: item.bins.non_biodegradable_bins, kg: item.bins.non_biodegradable_bin_kg }) : null,
                                                                ].filter(Boolean).join(' · ')} · <span className="font-semibold">{t('Total: :kg kg', { kg: item.bins.total_kg.toLocaleString() })}</span>
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="flex items-center gap-2">
                                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === 'collected' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'}`}>{item.status === 'collected' ? t('Collected') : t('Missed')}</span>
                                                        {canEditProperty(item.property.id) && item.collection_id && (
                                                            <button type="button" onClick={() => setConfirm({ url: route('utilities.collections.destroy', item.collection_id), title: t('Remove this record?'), message: t('The collection goes back to “To confirm”.') })} className="rounded p-1 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-red-700 dark:hover:text-red-200" aria-label={t('Remove this record?')}><Trash2 size={14} /></button>
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </section>
                        </div>

                        <section aria-labelledby="score-title">
                            <h2 id="score-title" className="font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{t('Green property score')}</h2>
                            <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-300">{t('Out of 100: usage trend (35), no high-use alerts (20), monthly readings recorded (20) and waste collected on schedule (25).')}</p>
                            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {scores.map(score => (
                                    <article key={score.property.id} className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="font-semibold text-gray-900 dark:text-slate-100">{score.property.name}</h3>
                                            <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ring-1 ${GRADE_TONE[score.grade]}`} aria-label={t('Grade :grade', { grade: score.grade })}>{score.grade}</span>
                                        </div>
                                        <p className="mt-2 font-[Sora] text-3xl font-bold text-gray-900 dark:text-slate-100">{score.score}<span className="text-base font-semibold text-gray-500 dark:text-slate-400">/100</span></p>
                                        <dl className="mt-3 space-y-1.5 text-xs">
                                            {[['trend', t('Usage trend'), 35], ['alerts', t('No alerts'), 20], ['records', t('Readings recorded'), 20], ['waste', t('Waste collection'), 25]].map(([key, label, out]) => (
                                                <div key={key} className="flex items-center gap-2">
                                                    <dt className="w-32 flex-none text-gray-700 dark:text-slate-200">{label}</dt>
                                                    <dd className="flex flex-1 items-center gap-2">
                                                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800"><span className="block h-full rounded-full bg-emerald-600" style={{ width: `${(score.parts[key] / out) * 100}%` }} /></span>
                                                        <span className="w-10 text-right tabular-nums text-gray-800 dark:text-slate-100">{score.parts[key]}/{out}</span>
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                        {score.tips.length > 0 && (
                                            <ul className="mt-3 space-y-1 border-t border-gray-100 dark:border-slate-800 pt-3 text-xs text-gray-700 dark:text-slate-200">
                                                {score.tips.map(tip => <li key={tip} className="flex gap-1.5"><Lightbulb size={13} className="mt-0.5 flex-none text-amber-600 dark:text-amber-400" aria-hidden="true" />{t(tip)}</li>)}
                                            </ul>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </section>

                        <section aria-labelledby="readings-title" className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                            <div className="border-b border-gray-100 dark:border-slate-800 px-5 py-4 sm:px-6">
                                <h2 id="readings-title" className="font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{t('Meter readings and bills')}</h2>
                            </div>
                            {readings.length === 0 ? (
                                <p className="px-5 py-6 text-sm text-gray-600 dark:text-slate-300 sm:px-6">{t('No readings yet. Record the water and electricity meters once a month.')}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-gray-600 dark:text-slate-300">
                                            <tr>
                                                <th scope="col" className="px-5 py-3">{t('Month')}</th>
                                                <th scope="col" className="px-3 py-3">{t('Building')}</th>
                                                <th scope="col" className="px-3 py-3">{t('Meter')}</th>
                                                <th scope="col" className="px-3 py-3 text-right">{t('Reading')}</th>
                                                <th scope="col" className="px-3 py-3 text-right">{t('Used')}</th>
                                                <th scope="col" className="px-3 py-3 text-right">{t('Bill')}</th>
                                                {canEdit && <th scope="col" className="px-3 py-3"><span className="sr-only">{t('Actions')}</span></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                            {readings.map(reading => {
                                                const Icon = TYPE_ICON[reading.type];

                                                return (
                                                    <tr key={reading.id}>
                                                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-slate-100">{monthLabel(reading.month, 'long')}</td>
                                                        <td className="px-3 py-3 text-gray-800 dark:text-slate-100">{reading.property}</td>
                                                        <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 text-gray-800 dark:text-slate-100"><Icon size={14} aria-hidden="true" />{typeLabel(reading.type)}</span>{reading.meter_replaced && <span className="ml-2 rounded bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-gray-700 dark:text-slate-200">{t('New meter')}</span>}</td>
                                                        <td className="px-3 py-3 text-right tabular-nums">{number(reading.reading)}</td>
                                                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{number(reading.consumption)} {units[reading.type]}</td>
                                                        <td className="px-3 py-3 text-right tabular-nums">{reading.cost !== null ? money(reading.cost) : '—'}{reading.bill_reference && <span className="block text-xs text-gray-500 dark:text-slate-400">{reading.bill_reference}</span>}</td>
                                                        {canEdit && (canEditProperty(reading.property_id) ? (
                                                            <td className="px-3 py-3 text-right">
                                                                <button type="button" onClick={() => setConfirm({ url: route('utilities.readings.destroy', reading.id), title: t('Delete this reading?'), message: t('The trends and score will be worked out again without it.') })} className="rounded p-1.5 text-gray-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300" aria-label={t('Delete this reading?')}><Trash2 size={15} /></button>
                                                            </td>) : <td />)}
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {canEdit && readingForm && (
                <ReadingForm show onClose={() => setReadingForm(null)} properties={editable} latest={latest} units={units} defaultPropertyId={filters.property_id} defaultType={readingForm.type} t={t} />
            )}
            {canEdit && scheduleForm && <ScheduleForm show onClose={() => setScheduleForm(false)} properties={editable} defaultPropertyId={filters.property_id} t={t} />}
            {canEdit && <CollectionForm key={collection ? `${collection.property.id}-${collection.date}` : 'none'} item={collection} onClose={() => setCollection(null)} money={money} formatDate={formatDate} t={t} />}
            <ConfirmActionModal
                open={confirm !== null}
                title={confirm?.title || ''}
                message={confirm?.message || ''}
                confirmLabel={t('Yes, continue')}
                tone="danger"
                processing={busy}
                onConfirm={runConfirm}
                onCancel={() => setConfirm(null)}
            />
        </AuthenticatedLayout>
    );
}
