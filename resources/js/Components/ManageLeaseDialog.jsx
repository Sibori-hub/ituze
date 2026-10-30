import MobileMoneyRequestPanel from '@/Components/MobileMoneyRequestPanel';
import usePresence from '@/hooks/usePresence';
import { useTranslation } from '@/localization';
import { Link, router } from '@inertiajs/react';
import {
    AlertCircle, CalendarClock, CheckCircle2, FileCheck, FileText, Landmark, Loader2, RefreshCcw, ShieldCheck, Smartphone, Upload, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const LEASE_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
const LEASE_MAX_BYTES = 10 * 1024 * 1024;

const PAYMENT_METHODS = [
    { value: 'bank_transfer', label: 'Bank transfer', icon: Landmark, reference: 'Bank slip reference', missing: 'Enter the bank slip reference.' },
    { value: 'mobile_money', label: 'Mobile money', icon: Smartphone, reference: 'Mobile money transaction ID', missing: 'Enter the mobile money transaction ID.' },
    { value: 'cheque', label: 'Cheque', icon: FileCheck, reference: 'Cheque number', missing: 'Enter the cheque number.' },
];

const fieldClass = (invalid) => `mt-1.5 w-full rounded-xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-gray-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 ${invalid ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-300 dark:border-slate-600 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;

const iso = (date) => date.toISOString().slice(0, 10);
const parse = (value) => {
    const [y, m, d] = String(value || '').slice(0, 10).split('-').map(Number);
    return y ? new Date(Date.UTC(y, m - 1, d)) : null;
};
const addDays = (value, days) => { const d = parse(value); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
/** Same date `months` later minus one day. */
const leaseEnd = (start, months) => {
    const s = parse(start);
    if (!s) return '';
    const target = s.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(s.getUTCFullYear(), target + 1, 0)).getUTCDate();
    const end = new Date(Date.UTC(s.getUTCFullYear(), target, Math.min(s.getUTCDate(), lastDay)));
    end.setUTCDate(end.getUTCDate() - 1);
    return iso(end);
};
const todayIso = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/**
 * Manage a lease: see where it stands and renew it. A monthly renewal is paid
 * one month at signing; the security deposit carries forward.
 */
export default function ManageLeaseDialog({ lease, onClose }) {
    const open = Boolean(lease);
    const { mounted, closing } = usePresence(open);
    const shown = useRef(lease);
    if (lease) shown.current = lease;

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => event.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!mounted || !shown.current) return null;

    return createPortal(
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6 ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`}>
            <div role="dialog" aria-modal="true" aria-labelledby="manage-lease-title"
                className={`flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl ${closing ? 'animate-pop-out' : 'animate-pop-in'}`}>
                <ManageLeaseContent key={shown.current.id} lease={shown.current} onClose={onClose} />
            </div>
        </div>,
        document.body,
    );
}

function ManageLeaseContent({ lease, onClose }) {
    const { t, language } = useTranslation();
    const locale = ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 2 })} RWF`;
    const dateLabel = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parse(value)) : '—');

    const tenancy = lease.tenancy;
    const unit = tenancy.unit;
    const property = unit?.property;
    const monthly = tenancy.rent_frequency !== 'daily';
    const firstStart = tenancy.end_date ? addDays(tenancy.end_date, 1) : todayIso();
    // Expired leases continue from the day after they ended; otherwise renewals start today or later.
    const defaultStart = firstStart >= todayIso() || lease.term_status === 'Expired' ? firstStart : todayIso();

    const [data, setFormData] = useState({
        start_date: defaultStart,
        end_date: leaseEnd(defaultStart, 12),
        monthly_rent: String(Number(tenancy.monthly_rent || 0)),
        payment_method: '',
        payment_reference: '',
        mobile_money_request_id: '',
        lease: null,
        lease_notes: '',
    });
    const setData = (field, value) => setFormData(current => ({ ...current, [field]: value }));
    const [momoMode, setMomoMode] = useState('request');
    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [fileNotice, setFileNotice] = useState('');
    const fileInput = useRef(null);

    const method = PAYMENT_METHODS.find(m => m.value === data.payment_method);
    const phoneRequest = data.payment_method === 'mobile_money' && momoMode === 'request';
    const rent = Number(data.monthly_rent) || 0;

    const errors = useMemo(() => {
        const e = {};
        if (!data.start_date) e.start_date = t('Choose the start date.');
        else if (tenancy.end_date && data.start_date <= String(tenancy.end_date).slice(0, 10)) e.start_date = t('A renewal must start after the current lease end date.');
        else if (data.start_date < todayIso() && data.start_date !== firstStart) e.start_date = t('A renewal starts today or later, or the day after the current lease ended.');
        if (!data.end_date) e.end_date = t('Choose the end date.');
        else if (data.end_date <= data.start_date) e.end_date = t('The end date must be after the start date.');
        if (!(rent > 0)) e.monthly_rent = t('Enter the rent in RWF.');
        if (!data.payment_method) e.payment_method = t('Choose how the money was paid.');
        else if (phoneRequest) {
            if (!data.mobile_money_request_id) e.mobile_money_request_id = t('Send the payment request and wait for the tenant to approve it.');
        } else if (!data.payment_reference.trim()) e.payment_reference = t(method?.missing || 'Enter the transaction reference.');
        if (!data.lease) e.lease = t('Upload the signed lease.');
        return e;
    }, [data, rent, phoneRequest, method, firstStart, tenancy.end_date, t]);

    const shownError = (field) => serverErrors[field] || (submitted ? errors[field] : undefined);
    const ErrorLine = ({ field }) => shownError(field) ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><AlertCircle size={12} aria-hidden="true" />{shownError(field)}</p>
    ) : null;

    const pickFile = (file) => {
        if (!file) return;
        const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (!LEASE_TYPES.split(',').includes(extension)) return setFileNotice(t('Upload a PDF, Word document or photo (JPG, PNG).'));
        if (file.size > LEASE_MAX_BYTES) return setFileNotice(t('The lease file must be 10 MB or smaller.'));
        setFileNotice('');
        setData('lease', file);
    };

    const submit = (event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(errors).length) return;

        const form = new FormData();
        form.append('start_date', data.start_date);
        form.append('end_date', data.end_date);
        form.append('monthly_rent', data.monthly_rent);
        form.append('rent_frequency', 'monthly');
        form.append('payment_method', data.payment_method);
        if (phoneRequest) form.append('mobile_money_request_id', data.mobile_money_request_id);
        else form.append('payment_reference', data.payment_reference.trim());
        form.append('lease_notes', data.lease_notes);
        form.append('lease', data.lease);

        setProcessing(true);
        router.post(route('properties.units.tenancy.renewals.store', [property.id, unit.id, tenancy.id]), form, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => onClose(),
            onError: (errs) => setServerErrors(errs),
            onFinish: () => setProcessing(false),
        });
    };

    const statusTone = lease.term_status === 'Expired' ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-900 dark:text-red-300'
        : lease.term_status === 'Expiring soon' ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300'
            : 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-900 dark:text-green-300';

    return (
        <>
            {/* Header */}
            <div className="relative border-b border-gray-100 dark:border-slate-800 bg-gradient-to-br from-[#0E3B2E]/[0.06] via-white dark:via-slate-900 to-amber-50/60 px-6 pb-5 pt-6">
                <div className="flex items-start gap-4 pr-10">
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white shadow-md shadow-[#0E3B2E]/20"><CalendarClock size={22} aria-hidden="true" /></span>
                    <div className="min-w-0">
                        <h2 id="manage-lease-title" className="font-[Sora] text-xl font-bold text-gray-900 dark:text-slate-100">{t('Manage lease')}</h2>
                        <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-slate-300">{tenancy.tenant?.name} · {property?.name} · {t('Room :number', { number: unit?.unit_number })}</p>
                    </div>
                </div>
                <button type="button" onClick={onClose} aria-label={t('Close')} className="absolute right-4 top-4 rounded-xl p-2 text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-white">
                    <X size={20} aria-hidden="true" />
                </button>
                <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm ${statusTone}`}>
                    <span className="font-semibold">{t(lease.term_status === 'Expired' ? 'Expired – action needed' : lease.term_status)} · {lease.countdown_label}</span>
                    <span>{dateLabel(tenancy.start_date)} → {dateLabel(tenancy.end_date)}</span>
                </div>
            </div>

            {!monthly ? (
                <div className="space-y-3 p-6 text-sm text-gray-700 dark:text-slate-200">
                    <p>{t('Nightly stays are extended from the room page.')}</p>
                    <Link href={route('properties.units.show', [property.id, unit.id])} className="inline-flex rounded-xl bg-[#0E3B2E] px-4 py-2.5 font-semibold text-white">{t('Open the room page')}</Link>
                </div>
            ) : (
                <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                        <section>
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-slate-100"><RefreshCcw size={16} className="text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />{t('Renew / extend')}</h3>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                <label className="text-sm font-medium text-gray-800 dark:text-slate-100">{t('New start date')}
                                    <input type="date" value={data.start_date} min={firstStart} onChange={e => setData('start_date', e.target.value)} className={fieldClass(shownError('start_date'))} />
                                    <ErrorLine field="start_date" />
                                </label>
                                <label className="text-sm font-medium text-gray-800 dark:text-slate-100">{t('New end date')}
                                    <input type="date" value={data.end_date} min={data.start_date} onChange={e => setData('end_date', e.target.value)} className={fieldClass(shownError('end_date'))} />
                                    <ErrorLine field="end_date" />
                                </label>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-gray-600 dark:text-slate-300">{t('Lease length:')}</span>
                                {[6, 12, 24].map(months => {
                                    const end = leaseEnd(data.start_date, months);
                                    const active = data.end_date === end;
                                    return (
                                        <button key={months} type="button" onClick={() => setData('end_date', end)}
                                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${active ? 'border-[#0E3B2E] dark:border-emerald-500 bg-[#0E3B2E] text-white' : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 hover:border-[#0E3B2E]/50'}`}>
                                            {months === 12 ? t('1 year') : months === 24 ? t('2 years') : t(':count months', { count: months })}
                                        </button>
                                    );
                                })}
                            </div>
                            <label className="mt-4 block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Monthly rent (RWF)')}
                                <span className="relative block">
                                    <span className="pointer-events-none absolute left-4 top-1/2 mt-[3px] -translate-y-1/2 text-xs font-semibold text-gray-500 dark:text-slate-400" aria-hidden="true">RWF</span>
                                    <input type="number" min="1" step="100" value={data.monthly_rent} onChange={e => { setData('monthly_rent', e.target.value); setData('mobile_money_request_id', ''); }} className={`${fieldClass(shownError('monthly_rent'))} pl-14`} />
                                </span>
                                <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">{t('Current rent: :amount. Change it if the new lease has a different rent.', { amount: money(tenancy.monthly_rent) })}</span>
                                <ErrorLine field="monthly_rent" />
                            </label>
                        </section>

                        {/* Payment at signing */}
                        <section className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('First month, paid now')}</p>
                                    <p className="mt-2 font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{money(rent)}</p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('From month 2, rent is paid month by month.')}</p>
                                </div>
                                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-gradient-to-br from-amber-50 dark:from-amber-500/10 to-white dark:to-slate-900 p-4 shadow-sm">
                                    <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-slate-100"><ShieldCheck size={16} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />{t('Security deposit')}</p>
                                    <p className="mt-2 font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{money(tenancy.deposit_amount)}</p>
                                    <p className="mt-1 text-xs text-amber-900/80">{t('Carries forward to the new lease. Nothing to pay.')}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-[#0E3B2E] to-[#1a5a45] px-5 py-3.5 text-white">
                                <span className="text-sm font-semibold">{t('Total to collect now')}</span>
                                <span className="font-[Sora] text-xl font-bold">{money(rent)}</span>
                            </div>

                            <fieldset>
                                <legend className="text-sm font-medium text-gray-800 dark:text-slate-100">{t('Payment method')}</legend>
                                <div className="mt-2 grid grid-cols-3 gap-2">
                                    {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => {
                                        const selected = data.payment_method === value;
                                        return (
                                            <label key={value} className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold transition-all focus-within:ring-2 focus-within:ring-[#0E3B2E]/30 ${selected ? 'border-[#0E3B2E] dark:border-emerald-500 bg-[#0E3B2E]/[0.05] text-[#0E3B2E] dark:text-emerald-300' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                                                <input type="radio" name="renew-payment-method" value={value} checked={selected} className="sr-only"
                                                    onChange={() => setFormData(current => ({ ...current, payment_method: value, payment_reference: '', mobile_money_request_id: '' }))} />
                                                <Icon size={20} aria-hidden="true" />{t(label)}
                                            </label>
                                        );
                                    })}
                                </div>
                                <ErrorLine field="payment_method" />
                            </fieldset>

                            {phoneRequest && (
                                <div className="animate-fade-in">
                                    <MobileMoneyRequestPanel
                                        key={rent}
                                        tenant={tenancy.tenant}
                                        unit={{ id: unit.id, rent: rent }}
                                        amountLabel={money(rent)}
                                        extraPayload={{ purpose: 'renewal', tenancy_id: tenancy.id, monthly_rent: rent }}
                                        onPaid={(paid) => setFormData(current => ({ ...current, mobile_money_request_id: String(paid.id), payment_reference: paid.transaction_id || '' }))}
                                        onReset={() => setFormData(current => ({ ...current, mobile_money_request_id: '', payment_reference: '' }))}
                                    />
                                    <ErrorLine field="mobile_money_request_id" />
                                    {!data.mobile_money_request_id && (
                                        <button type="button" onClick={() => setMomoMode('manual')} className="mt-2 text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 underline underline-offset-2">{t('Already paid? Enter the transaction ID instead')}</button>
                                    )}
                                </div>
                            )}
                            {method && !phoneRequest && (
                                <label className="block animate-fade-in text-sm font-medium text-gray-800 dark:text-slate-100">{t(method.reference)}
                                    <input value={data.payment_reference} maxLength={255} onChange={e => setData('payment_reference', e.target.value)} className={`${fieldClass(shownError('payment_reference'))} font-mono tracking-wide`} />
                                    <ErrorLine field="payment_reference" />
                                    {data.payment_method === 'mobile_money' && (
                                        <button type="button" onClick={() => { setMomoMode('request'); setData('payment_reference', ''); }} className="mt-2 block text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 underline underline-offset-2">{t('Send a payment request to the tenant’s phone instead')}</button>
                                    )}
                                </label>
                            )}
                        </section>

                        {/* Signed renewal */}
                        <section>
                            <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{t('Signed renewal')}</p>
                            <input ref={fileInput} type="file" accept={LEASE_TYPES} className="hidden" tabIndex={-1} aria-hidden="true" onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                            {data.lease ? (
                                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-green-200 dark:border-green-500/30 bg-green-50/60 dark:bg-green-500/10 p-3.5">
                                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-green-600 text-white"><FileText size={18} aria-hidden="true" /></span>
                                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{data.lease.name}</span><span className="block text-xs text-gray-600 dark:text-slate-300">{(data.lease.size / 1024 / 1024).toFixed(2)} MB</span></span>
                                    <button type="button" onClick={() => fileInput.current?.click()} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 hover:bg-white dark:hover:bg-slate-800">{t('Change')}</button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => fileInput.current?.click()} className={`mt-2 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-6 text-center transition-colors hover:border-[#0E3B2E]/60 ${shownError('lease') ? 'border-red-300 dark:border-red-500/40 bg-red-50/40 dark:bg-red-500/10' : 'border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/60'}`}>
                                    <Upload size={22} className="text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />
                                    <span className="mt-2 text-sm font-semibold text-gray-900 dark:text-slate-100">{t('Upload the signed renewal')}</span>
                                    <span className="mt-0.5 text-xs text-gray-600 dark:text-slate-300">{t('PDF, Word or photo · up to 10 MB')}</span>
                                </button>
                            )}
                            {(fileNotice || shownError('lease')) && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fileNotice || shownError('lease')}</p>}
                            <label className="mt-4 block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Note (optional)')}
                                <textarea rows={2} maxLength={1000} value={data.lease_notes} onChange={e => setData('lease_notes', e.target.value)} className={fieldClass(false)} placeholder={t('For example: rent increased by agreement.')} />
                            </label>
                        </section>

                        {Object.entries(serverErrors).filter(([field]) => !['start_date', 'end_date', 'monthly_rent', 'payment_method', 'payment_reference', 'mobile_money_request_id', 'lease'].includes(field)).map(([field, message]) => (
                            <p key={field} role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-300"><AlertCircle size={16} className="mt-0.5 flex-none" aria-hidden="true" />{message}</p>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40 px-6 py-4">
                        <Link href={route('properties.units.show', [property.id, unit.id])} className="text-xs font-semibold text-gray-600 dark:text-slate-300 underline underline-offset-2 hover:text-[#0E3B2E] dark:hover:text-emerald-200">{t('Open the room page')}</Link>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} disabled={processing} className="rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">{t('Cancel')}</button>
                            <button disabled={processing} className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#124B3A] disabled:opacity-60">
                                {processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                                {processing ? t('Saving…') : t('Renew lease')}
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </>
    );
}
