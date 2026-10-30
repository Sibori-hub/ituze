import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useTranslation } from '@/localization';
import { Head, Link, router } from '@inertiajs/react';
import { CheckCircle2, FileText, Gift, Megaphone, XCircle } from 'lucide-react';
import { useState } from 'react';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const METHOD = { momo_pay: 'MoMo Pay', bank_transfer: 'Bank transfer', cheque: 'Cheque', mobile_money: 'Phone request' };
const TABS = [['pending', 'To check'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];

/** Admins check listing payments (MoMo Pay, bank transfer, cheque), then approve or reject them. */
export default function AdPayments({ payments = [], status = 'pending', counts = {} }) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const when = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—');
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const approve = (payment) => {
        setBusy(true);
        router.post(route('admin.ad-payments.approve', payment.id), {}, { preserveScroll: true, onFinish: () => setBusy(false) });
    };
    const reject = (event) => {
        event.preventDefault();
        setBusy(true);
        router.post(route('admin.ad-payments.reject', rejecting.id), { reason }, { preserveScroll: true, onSuccess: () => { setRejecting(null); setReason(''); }, onFinish: () => setBusy(false) });
    };

    return (
        <AuthenticatedLayout header="Ad payments">
            <Head title={t('Ad payments')} />
            <div className="mx-auto max-w-6xl space-y-5">
                <section className="flex flex-wrap items-start gap-4 rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300" aria-hidden="true"><Megaphone size={22} /></span>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{t('Advertisers’ listing payments')}</h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Check each payment against the MoMo or bank statement, then approve it (the listings are added) or reject it with a reason.')}</p>
                    </div>
                </section>

                <div role="tablist" className="flex flex-wrap gap-2">
                    {TABS.map(([value, label]) => (
                        <Link key={value} href={route('admin.ad-payments', { status: value })} preserveScroll role="tab" aria-selected={status === value}
                            className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${status === value ? 'bg-[#0E3B2E] text-white ring-[#0E3B2E]' : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 ring-gray-200 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                            {t(label)}{counts[value] !== undefined && <span className="ml-1.5 opacity-80">{counts[value]}</span>}
                        </Link>
                    ))}
                </div>

                {payments.length === 0 ? (
                    <p className="rounded-3xl bg-white dark:bg-slate-900 p-10 text-center text-sm text-gray-600 dark:text-slate-300 shadow-sm ring-1 ring-black/[0.04]">{status === 'pending' ? t('No payment waiting.') : t('Nothing here yet.')}</p>
                ) : (
                    <ul className="space-y-3">
                        {payments.map((payment) => (
                            <li key={payment.id} className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-black/[0.04]">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 dark:text-slate-100">{payment.advertiser?.name}</p>
                                        <p className="text-xs text-gray-600 dark:text-slate-300">{payment.advertiser?.email} · {payment.advertiser?.phone}</p>
                                        <p className="mt-2 text-sm text-gray-800 dark:text-slate-100">
                                            {payment.property ? <><span className="font-semibold">{payment.property.name}</span> · </> : null}{t(':count listing(s)', { count: payment.listings })}
                                            {(payment.bonus || payment.bonus_due) > 0 && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30"><Gift size={12} aria-hidden="true" />{t('+:free free (first purchase)', { free: payment.bonus || payment.bonus_due })}</span>}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-[Sora] text-xl font-bold tabular-nums text-gray-900 dark:text-slate-100">{money(payment.amount)}</p>
                                        <p className="text-xs text-gray-600 dark:text-slate-300">{t(METHOD[payment.method] || payment.method)} · {when(payment.created_at)}</p>
                                    </div>
                                </div>
                                <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-xl bg-gray-50 dark:bg-slate-800/60 p-3 text-xs text-gray-700 dark:text-slate-200 sm:grid-cols-2">
                                    {payment.bank_name && <div><dt className="inline font-semibold">{t('Bank')}: </dt><dd className="inline">{payment.bank_name}</dd></div>}
                                    {payment.account_number && <div><dt className="inline font-semibold">{t('Account number')}: </dt><dd className="inline font-mono">{payment.account_number}</dd></div>}
                                    {payment.sender_name && <div><dt className="inline font-semibold">{payment.method === 'cheque' ? t('Name on the cheque') : t('Paid by')}: </dt><dd className="inline">{payment.sender_name}{payment.sender_phone ? ` · ${payment.sender_phone}` : ''}</dd></div>}
                                    <div><dt className="inline font-semibold">{payment.method === 'cheque' ? t('Cheque number') : payment.method === 'bank_transfer' ? t('Reference number') : t('Transaction ID')}: </dt><dd className="inline font-mono">{payment.reference || '—'}</dd></div>
                                    {payment.sent_at && <div><dt className="inline font-semibold">{t('Paid on')}: </dt><dd className="inline">{when(payment.sent_at)}</dd></div>}
                                    {payment.has_proof && <div><a href={route('ad-payments.proof', payment.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0E3B2E] dark:text-emerald-300 underline underline-offset-2"><FileText size={12} aria-hidden="true" />{t('Open proof')}</a></div>}
                                </dl>
                                {payment.status === 'pending' ? (
                                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                                        <button type="button" onClick={() => { setRejecting(payment); setReason(''); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-500/30 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60"><XCircle size={15} aria-hidden="true" />{t('Reject')}</button>
                                        <button type="button" onClick={() => approve(payment)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60"><CheckCircle2 size={15} aria-hidden="true" />{t('Approve and add the listings')}</button>
                                    </div>
                                ) : (
                                    <p className={`mt-3 text-xs font-semibold ${payment.status === 'approved' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                                        {payment.status === 'approved' ? t('Approved') : t('Rejected')}{payment.reviewer ? ` · ${payment.reviewer}` : ''}{payment.reviewed_at ? ` · ${when(payment.reviewed_at)}` : ''}
                                        {payment.receipt_number ? ` · ${payment.receipt_number}` : ''}{payment.rejection_reason ? ` · ${payment.rejection_reason}` : ''}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {rejecting && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="reject-title">
                    <form onSubmit={reject} className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl">
                        <h2 id="reject-title" className="font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{t('Reject this payment?')}</h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t(':name is told why by email and SMS.', { name: rejecting.advertiser?.name })}</p>
                        <label className="mt-4 block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Reason')}
                            <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} required autoFocus placeholder={t('e.g. No payment with this transaction ID')}
                                className="mt-1.5 w-full rounded-xl border-gray-300 dark:border-slate-600 text-sm focus:border-[#0E3B2E] focus:ring-[#0E3B2E]" />
                        </label>
                        <div className="mt-5 flex justify-end gap-2">
                            <button type="button" onClick={() => setRejecting(null)} className="rounded-xl border border-gray-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">{t('Cancel')}</button>
                            <button disabled={busy || !reason.trim()} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{t('Reject')}</button>
                        </div>
                    </form>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
