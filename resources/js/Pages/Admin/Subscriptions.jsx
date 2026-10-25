import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmActionModal from '@/Components/ConfirmActionModal';
import usePresence from '@/hooks/usePresence';
import { useTranslation } from '@/localization';
import { Head, router, useForm } from '@inertiajs/react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, FileText, PauseCircle, Search, Wallet, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const TABS = [['pending', 'To check'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['failed', 'Not completed'], ['all', 'All']];
const METHOD_LABEL = { momo_pay: 'MoMo Pay', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', cheque: 'Cheque' };
const STATUS_STYLE = {
    approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    pending: 'bg-amber-50 text-amber-900 ring-amber-200',
    rejected: 'bg-red-50 text-red-800 ring-red-200',
    failed: 'bg-gray-100 text-gray-700 ring-gray-200',
};

export default function AdminSubscriptions({ payments, filters = {}, counts = {} }) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const date = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—');
    const [search, setSearch] = useState(filters.search || '');
    const [approving, setApproving] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [busy, setBusy] = useState(false);

    const visit = (changes) => router.get(route('admin.subscriptions'), { ...filters, ...changes }, { preserveScroll: true, preserveState: true, replace: true });
    useEffect(() => {
        if (search === (filters.search || '')) return undefined;
        const timer = setTimeout(() => visit({ search: search || undefined, page: undefined }), 350);
        return () => clearTimeout(timer);
    }, [search]);

    const approve = () => {
        setBusy(true);
        router.post(route('admin.subscriptions.approve', approving.id), {}, { preserveScroll: true, onFinish: () => { setBusy(false); setApproving(null); } });
    };

    return (
        <AuthenticatedLayout header="Subscriptions">
            <Head title={t('Subscriptions')} />
            <div className="mx-auto max-w-7xl space-y-5">
                <section className="flex flex-wrap items-start gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white" aria-hidden="true"><Wallet size={22} /></span>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Owner subscriptions')}</h1>
                        <p className="mt-1 text-sm text-gray-600">{t('Check bank slips and cheques sent by self-registered owners. Mobile money payments are applied automatically.')}</p>
                    </div>
                </section>

                <section aria-label={t('Summary')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                        ['To check', counts.pending, Clock3, 'bg-amber-50 text-amber-800 ring-amber-100', () => visit({ status: 'pending' })],
                        ['Ending in 7 days', counts.expiring, CalendarClock, 'bg-sky-50 text-sky-800 ring-sky-100'],
                        ['Overdue (grace)', counts.grace, AlertTriangle, 'bg-red-50 text-red-700 ring-red-100'],
                        ['Paused', counts.paused, PauseCircle, 'bg-gray-100 text-gray-700 ring-gray-200'],
                        ['Not paid yet', counts.unpaid, Clock3, 'bg-amber-50 text-amber-900 ring-amber-100'],
                        ['Received this month', money(counts.month_total), CheckCircle2, 'bg-emerald-50 text-emerald-800 ring-emerald-100'],
                    ].map(([label, value, Icon, tone, onClick]) => {
                        const Tag = onClick ? 'button' : 'div';
                        return (
                            <Tag key={label} type={onClick ? 'button' : undefined} onClick={onClick} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/[0.04] transition hover:shadow-md">
                                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${tone}`} aria-hidden="true"><Icon size={17} /></span>
                                <p className="mt-3 font-[Sora] text-xl font-bold tabular-nums text-gray-900">{value ?? 0}</p>
                                <p className="mt-0.5 text-xs font-medium text-gray-600 sm:text-sm">{t(label)}</p>
                            </Tag>
                        );
                    })}
                </section>

                <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                        <nav aria-label={t('Payment status')} className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
                            {TABS.map(([value, label]) => (
                                <button key={value} type="button" onClick={() => visit({ status: value, page: undefined })} aria-current={filters.status === value ? 'page' : undefined}
                                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${filters.status === value ? 'bg-white text-[#0E3B2E] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                                    {t(label)}{value === 'pending' && counts.pending ? ` (${counts.pending})` : ''}
                                </button>
                            ))}
                        </nav>
                        <label className="relative">
                            <span className="sr-only">{t('Search')}</span>
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Owner, reference or receipt')} className="w-64 rounded-xl border-gray-300 py-2 pl-9 text-sm" />
                        </label>
                    </div>

                    {payments.data.length ? (
                        <ul className="divide-y divide-gray-100">
                            {payments.data.map((payment) => (
                                <li key={payment.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                                    <div className="min-w-[200px] flex-1">
                                        <p className="font-semibold text-gray-900">{payment.owner?.name}</p>
                                        <p className="text-xs text-gray-600">{payment.owner?.email} · {payment.owner?.phone}</p>
                                        {payment.property && (
                                            <p className="mt-1 text-xs text-gray-800">
                                                <span className="font-semibold">{payment.property}</span>
                                                {' · '}
                                                <span className={`font-semibold ${payment.property_state === 'paused' ? 'text-red-700' : payment.property_state === 'grace' ? 'text-amber-800' : payment.property_state === 'unpaid' ? 'text-gray-600' : 'text-emerald-800'}`}>
                                                    {payment.property_paid_until ? t('Paid until :date', { date: date(payment.property_paid_until) }) : t('Not paid yet')}
                                                    {payment.property_state === 'paused' ? ` · ${t('Paused')}` : payment.property_state === 'grace' ? ` · ${t('Overdue')}` : ''}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                    <div className="min-w-[160px]">
                                        <p className="font-[Sora] font-bold tabular-nums text-gray-900">{money(payment.amount)}</p>
                                        <p className="text-xs text-gray-600">{t(payment.months === 1 ? '1 month' : ':count months', { count: payment.months })} · {date(payment.created_at)}</p>
                                    </div>
                                    <div className="min-w-[180px]">
                                        <p className="text-sm text-gray-800">{t(METHOD_LABEL[payment.method] || payment.method)}</p>
                                        {payment.method === 'momo_pay' ? (
                                            <dl className="mt-1 space-y-0.5 text-xs text-gray-700">
                                                <div><dt className="inline font-semibold">{t('Transaction ID')}: </dt><dd className="inline break-all font-mono">{payment.reference}</dd></div>
                                                <div><dt className="inline font-semibold">{t('Sender')}: </dt><dd className="inline">{payment.sender_name} · {payment.sender_phone}</dd></div>
                                                <div><dt className="inline font-semibold">{t('Paid on')}: </dt><dd className="inline">{payment.paid_at ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(payment.paid_at)) : '—'}</dd></div>
                                            </dl>
                                        ) : payment.bank_name ? (
                                            <dl className="mt-1 space-y-0.5 text-xs text-gray-700">
                                                <div><dt className="inline font-semibold">{t('Bank')}: </dt><dd className="inline">{payment.bank_name}</dd></div>
                                                <div><dt className="inline font-semibold">{t('Account number')}: </dt><dd className="inline break-all font-mono">{payment.account_number}</dd></div>
                                                <div><dt className="inline font-semibold">{payment.method === 'cheque' ? t('Name on the cheque') : t('Account name')}: </dt><dd className="inline">{payment.sender_name}</dd></div>
                                                <div><dt className="inline font-semibold">{payment.method === 'cheque' ? t('Cheque number') : t('Reference number')}: </dt><dd className="inline break-all font-mono">{payment.reference}</dd></div>
                                                <div><dt className="inline font-semibold">{payment.method === 'cheque' ? t('Cheque date') : t('Transfer date')}: </dt><dd className="inline">{payment.paid_at ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(payment.paid_at)) : '—'}</dd></div>
                                            </dl>
                                        ) : payment.reference && <p className="break-all font-mono text-xs text-gray-600">{payment.reference}</p>}
                                        {payment.has_proof && (
                                            <a href={route('subscription.proof', payment.id)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[#0E3B2E] hover:underline">
                                                <FileText size={12} aria-hidden="true" />{t('Open proof')}
                                            </a>
                                        )}
                                    </div>
                                    <div className="flex min-w-[220px] flex-wrap items-center justify-end gap-2">
                                        {payment.status === 'pending' && payment.method !== 'mobile_money' ? (
                                            <>
                                                <button type="button" onClick={() => setRejecting(payment)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"><XCircle size={14} aria-hidden="true" />{t('Reject')}</button>
                                                <button type="button" onClick={() => setApproving(payment)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#124B3A]"><CheckCircle2 size={14} aria-hidden="true" />{t('Approve')}</button>
                                            </>
                                        ) : (
                                            <div className="text-right">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_STYLE[payment.status] || STATUS_STYLE.failed}`}>{t({ approved: 'Approved', pending: 'Waiting on phone', rejected: 'Rejected', failed: 'Not completed' }[payment.status] || payment.status)}</span>
                                                {payment.receipt_number && <p className="mt-1 font-mono text-[11px] text-gray-500">{payment.receipt_number}</p>}
                                                {payment.reviewer && <p className="text-[11px] text-gray-500">{t('by :name', { name: payment.reviewer })}</p>}
                                                {payment.rejection_reason && <p className="mt-1 max-w-[240px] text-xs text-red-700">{payment.rejection_reason}</p>}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="px-5 py-10 text-center text-sm text-gray-600">{filters.status === 'pending' ? t('Nothing to check right now.') : t('No payments found.')}</p>
                    )}
                    {payments.last_page > 1 && (
                        <nav aria-label={t('Pages')} className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm">
                            <span className="text-gray-600">{t('Page :page of :pages', { page: payments.current_page, pages: payments.last_page })}</span>
                            <div className="flex gap-2">
                                <button type="button" disabled={!payments.prev_page_url} onClick={() => visit({ page: payments.current_page - 1 })} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40">{t('Previous')}</button>
                                <button type="button" disabled={!payments.next_page_url} onClick={() => visit({ page: payments.current_page + 1 })} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40">{t('Next')}</button>
                            </div>
                        </nav>
                    )}
                </section>
            </div>

            <ConfirmActionModal
                open={approving !== null}
                title={t('Approve :amount from :owner?', { amount: money(approving?.amount), owner: approving?.owner?.name })}
                message={t('Only approve after checking the money arrived on the Q.R.A account. The owner gets :months more and a receipt by email and SMS.', { months: t(approving?.months === 1 ? '1 month' : ':count months', { count: approving?.months }) })}
                confirmLabel={t('Approve')}
                processing={busy}
                onConfirm={approve}
                onCancel={() => setApproving(null)}
            />
            <RejectDialog payment={rejecting} onClose={() => setRejecting(null)} />
        </AuthenticatedLayout>
    );
}

function RejectDialog({ payment, onClose }) {
    const { t } = useTranslation();
    const open = payment !== null;
    const { mounted, closing } = usePresence(open);
    const form = useForm({ reason: '' });
    const [shown, setShown] = useState(null);
    useEffect(() => { if (open) { setShown(payment); form.reset(); form.clearErrors(); } }, [open]);
    if (!mounted) return null;

    const submit = (event) => {
        event.preventDefault();
        form.post(route('admin.subscriptions.reject', shown.id), { preserveScroll: true, onSuccess: () => onClose() });
    };

    return createPortal(
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`}>
            <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="reject-title" className={`relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ${closing ? 'animate-pop-out' : 'animate-pop-in'}`}>
                <button type="button" onClick={onClose} aria-label={t('Close')} className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X size={18} aria-hidden="true" /></button>
                <h2 id="reject-title" className="font-[Sora] text-lg font-bold text-gray-900">{t('Reject this payment?')}</h2>
                <p className="mt-1 text-sm text-gray-600">{t('The owner receives this reason by email and SMS, and can pay again.')}</p>
                <label className="mt-4 block text-sm font-medium text-gray-800">{t('Reason')}
                    <textarea rows={3} value={form.data.reason} onChange={(event) => form.setData('reason', event.target.value)} placeholder={t('For example: the money has not arrived on our account yet.')}
                        className={`mt-1.5 w-full rounded-xl border px-3 py-2 text-sm ${form.errors.reason ? 'border-red-400' : 'border-gray-300'}`} />
                    {form.errors.reason && <span className="mt-1 block text-xs text-red-600">{form.errors.reason}</span>}
                </label>
                <div className="mt-5 flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">{t('Cancel')}</button>
                    <button disabled={form.processing} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{form.processing ? t('Saving…') : t('Reject')}</button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
