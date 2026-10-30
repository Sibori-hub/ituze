import RwandaFlag from '@/Components/RwandaFlag';
import RwandaPhoneInput from '@/Components/RwandaPhoneInput';
import { csrfFetch } from '@/lib/csrf';
import { formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { useTranslation } from '@/localization';
import { useForm } from '@inertiajs/react';
import {
    AlertCircle, CheckCircle2, FileCheck2, Loader2, Send, Smartphone, Upload, XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/*
 * The forms an owner uses to pay for a property: MoMo Pay (details from the
 * MoMo SMS), a bank slip or cheque, and (once the MoMo API is connected) a
 * payment request to the phone. Used on Subscription and on Pay for a property.
 */

const call = async (url, options = {}) => {
    const res = await csrfFetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const first = json?.errors ? Object.values(json.errors)[0] : null;
        throw new Error((Array.isArray(first) ? first[0] : first) || json?.message || 'Request failed');
    }
    return json;
};

/** Request to pay on the owner's phone, then follow it until approved. */
export function MobileMoneyPay({ plan, total, defaultPhone, money, onPaid }) {
    const { t } = useTranslation();
    const [phone, setPhone] = useState(toLocalDigits(defaultPhone || ''));
    const [state, setState] = useState({ step: 'idle', error: '', payment: null, request: null });
    const poll = useRef(null);
    const phoneValid = RWANDA_MOBILE_REGEX.test(phone);

    const stop = () => { clearInterval(poll.current); poll.current = null; };
    useEffect(() => stop, []);
    useEffect(() => { stop(); setState({ step: 'idle', error: '', payment: null, request: null }); }, [months]);

    const follow = (paymentId) => {
        stop();
        poll.current = setInterval(async () => {
            try {
                const result = await call(route('subscription.momo.status', paymentId));
                if (result.request.status === 'successful') {
                    stop();
                    setState((current) => ({ ...current, step: 'paid', request: result.request, payment: result.payment }));
                    onPaid(result.subscription);
                } else if (['failed', 'expired'].includes(result.request.status)) {
                    stop();
                    setState((current) => ({ ...current, step: 'failed', error: result.request.failure_reason || t('The payment was not completed.') }));
                }
            } catch {
                /* keep trying until the request times out */
            }
        }, 4000);
    };

    const send = async () => {
        if (!phoneValid) {
            setState((current) => ({ ...current, error: t('Enter 10 digits starting with 078, 079, 072, or 073.') }));
            return;
        }
        setState({ step: 'sending', error: '', payment: null, request: null });
        try {
            const result = await call(route('subscription.momo.start'), { method: 'POST', body: JSON.stringify({ ...plan, phone: `0${phone}` }) });
            setState({ step: 'waiting', error: '', payment: result.payment, request: result.request });
            follow(result.payment.id);
        } catch (error) {
            setState({ step: 'idle', error: error.message, payment: null, request: null });
        }
    };

    if (state.step === 'paid') {
        return (
            <div className="animate-pop-in rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-5 text-center" role="status">
                <CheckCircle2 size={36} className="mx-auto text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                <p className="mt-2 font-[Sora] text-lg font-bold text-emerald-950 dark:text-emerald-300">{t('Payment received. Thank you!')}</p>
                <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-300">{t('Receipt :number. You get a confirmation by email and SMS.', { number: state.payment?.receipt_number || '' })}</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
            <label htmlFor="momo-phone" className="text-sm font-medium text-gray-800 dark:text-slate-100">{t('Phone that pays (MTN MoMo or Airtel Money)')}</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
                <div className={`flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-sm focus-within:ring-2 ${state.error ? 'border-red-400 focus-within:ring-red-500/20' : 'border-gray-300 dark:border-slate-600 focus-within:border-[#0E3B2E] focus-within:ring-[#0E3B2E]/15'}`}>
                    <span className="flex select-none items-center gap-2 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-3 text-sm font-semibold text-gray-700 dark:text-slate-200"><RwandaFlag className="h-[15px] w-[22px]" />+250</span>
                    <input id="momo-phone" type="tel" inputMode="numeric" value={formatPhone(phone)} placeholder="788 123 456" disabled={state.step === 'waiting' || state.step === 'sending'}
                        onChange={(event) => setPhone(toLocalDigits(event.target.value))}
                        className="w-full min-w-0 border-0 bg-transparent px-3 py-2.5 text-sm tracking-wide focus:ring-0" />
                </div>
                <button type="button" onClick={send} disabled={state.step === 'waiting' || state.step === 'sending'}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60">
                    {state.step === 'sending' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                    {t('Pay :amount', { amount: money(total) })}
                </button>
            </div>
            {phoneValid && !state.error && state.step === 'idle' && <p className="mt-1 text-xs text-green-700 dark:text-green-300">{t(':network number', { network: getNetwork(phone) })}</p>}
            {state.error && <p className="mt-2 flex items-center gap-1.5 text-sm text-red-700 dark:text-red-300" role="alert"><AlertCircle size={15} aria-hidden="true" />{state.error}</p>}
            {state.step === 'waiting' && (
                <div className="mt-3 flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30" role="status" aria-live="polite">
                    <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-amber-700 dark:text-amber-300" aria-hidden="true" />
                    <p>{t('Check your phone: approve the payment of :amount with your PIN. This page updates by itself.', { amount: money(total) })}</p>
                </div>
            )}
            {state.step === 'failed' && (
                <div className="mt-3 flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-900 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-500/30" role="alert">
                    <XCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>{t('The payment was not completed. You can try again.')}</p>
                </div>
            )}
        </div>
    );
}

// "2026-10-24T14:05" for a datetime-local box, in the visitor's own time.
const localDateTime = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * MoMo Pay without the API: pay our merchant code, then type what the MoMo
 * SMS says. ITUZE checks it against the MoMo statement and approves.
 */
export function MomoPayForm({ plan, propertyName, total, money, momoPay, defaultPhone, submitRoute = 'subscription.momopay', amountHelp = null }) {
    const { t } = useTranslation();
    const form = useForm({ ...plan, amount: total, sender_name: '', sender_phone: toLocalDigits(defaultPhone || ''), paid_at: localDateTime(new Date()), transaction_id: '', proof: null });
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => { form.setData((current) => ({ ...current, ...plan, amount: total })); }, [plan.property_id, plan.months, plan.listings, total]);

    const dial = momoPay.code ? `*182*8*1*${momoPay.code}#` : null;
    const clientErrors = {};
    if (!form.data.sender_name.trim()) clientErrors.sender_name = t('Enter the name of the person who paid.');
    if (!RWANDA_MOBILE_REGEX.test(form.data.sender_phone)) clientErrors.sender_phone = t('Enter the 9 digits after +250, starting with 72, 73, 78 or 79.');
    if (!form.data.paid_at) clientErrors.paid_at = t('Enter the date and time of the payment.');
    if (!/^[0-9]{6,20}$/.test(form.data.transaction_id.replace(/\s+/g, ''))) clientErrors.transaction_id = t('Enter the transaction ID from the MoMo SMS: numbers only.');
    const errorFor = (field) => form.errors[field] || (submitted ? clientErrors[field] : null);
    const fieldClass = (field) => `mt-1.5 w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${errorFor(field) ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-300 dark:border-slate-600 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;

    const submit = (event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(clientErrors).length) return;
        form.transform((data) => ({ ...data, sender_phone: `0${data.sender_phone}` }));
        form.post(route(submitRoute), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { form.reset('transaction_id', 'proof', 'sender_name'); setSubmitted(false); },
        });
    };

    return (
        <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
            <div className="rounded-xl bg-[#FFCC00]/15 p-4 ring-1 ring-[#FFCC00]/50">
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{t('Pay with MoMo Pay')}</p>
                {dial ? (
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-gray-800 dark:text-slate-100">
                        <li>
                            {t('Dial')}{' '}
                            <a href={`tel:${encodeURIComponent(dial)}`} className="rounded bg-white dark:bg-slate-900 px-1.5 py-0.5 font-mono font-bold text-gray-900 dark:text-slate-100 ring-1 ring-gray-200 dark:ring-slate-700">{dial}</a>
                            {' '}{t('or choose MoMo Pay in the MoMo app and enter the code')}{' '}
                            <span className="font-mono font-bold">{momoPay.code}</span>
                            <button type="button" onClick={() => navigator.clipboard?.writeText(momoPay.code)} className="ml-1.5 rounded-md bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-[#0E3B2E] dark:text-emerald-300 ring-1 ring-gray-200 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">{t('Copy')}</button>
                        </li>
                        <li>{t('Pay exactly :amount to :name.', { amount: money(total), name: momoPay.name })}</li>
                        <li>{t('Fill in the form below with the details from your MoMo SMS.')}</li>
                    </ol>
                ) : (
                    <p className="mt-1 text-sm text-gray-800 dark:text-slate-100">{t('The MoMo Pay code will be shown here soon. Until then, call ITUZE on 0793 905 166 to get it.')}</p>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                    {t('Name of the person who paid')}
                    <input value={form.data.sender_name} onChange={(event) => form.setData('sender_name', event.target.value)} autoComplete="name" className={fieldClass('sender_name')} aria-invalid={errorFor('sender_name') ? 'true' : undefined} />
                    {errorFor('sender_name') && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{t(errorFor('sender_name'))}</span>}
                </label>
                <div>
                    <label htmlFor="momo-sender-phone" className="block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Phone number that paid')}</label>
                    <RwandaPhoneInput id="momo-sender-phone" value={form.data.sender_phone} onChange={(digits) => form.setData('sender_phone', digits)} error={errorFor('sender_phone')} className="mt-1.5" />
                </div>
                <label className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                    {t('Amount paid')}
                    <input value={money(total)} readOnly className="mt-1.5 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-100" aria-describedby="momo-amount-help" />
                    <span id="momo-amount-help" className="mt-1 block text-xs text-gray-600 dark:text-slate-300">{amountHelp ?? t(':property for :months month(s). Change it above if you paid for more.', { property: propertyName ?? '', months: plan.months })}</span>
                    {form.errors.amount && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{t(form.errors.amount)}</span>}
                </label>
                <label className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                    {t('Date and time of the payment')}
                    <input type="datetime-local" value={form.data.paid_at} max={localDateTime(new Date())} onChange={(event) => form.setData('paid_at', event.target.value)} className={fieldClass('paid_at')} aria-invalid={errorFor('paid_at') ? 'true' : undefined} />
                    {errorFor('paid_at') && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{t(errorFor('paid_at'))}</span>}
                </label>
                <label className="block text-sm font-medium text-gray-800 dark:text-slate-100 sm:col-span-2">
                    {t('MoMo transaction ID')}
                    <input value={form.data.transaction_id} onChange={(event) => form.setData('transaction_id', event.target.value.replace(/[^\d\s]/g, ''))} inputMode="numeric" placeholder="1234567890" className={`${fieldClass('transaction_id')} font-mono tracking-wide`} aria-invalid={errorFor('transaction_id') ? 'true' : undefined} aria-describedby="momo-txn-help" />
                    <span id="momo-txn-help" className="mt-1 block text-xs text-gray-600 dark:text-slate-300">{t('In the MoMo SMS, after "Financial Transaction Id" or "TxId".')}</span>
                    {errorFor('transaction_id') && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{t(errorFor('transaction_id'))}</span>}
                </label>
            </div>

            <div>
                <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{t('Screenshot of the MoMo SMS')} <span className="font-normal text-gray-500 dark:text-slate-400">({t('optional')})</span></p>
                <label className={`mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm transition ${form.data.proof ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/10' : 'border-gray-300 dark:border-slate-600 hover:border-[#0E3B2E]/40 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(event) => form.setData('proof', event.target.files?.[0] || null)} />
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-[#0E3B2E] dark:text-emerald-300 ring-1 ring-gray-200 dark:ring-slate-700" aria-hidden="true">{form.data.proof ? <FileCheck2 size={17} /> : <Upload size={17} />}</span>
                    <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900 dark:text-slate-100">{form.data.proof ? form.data.proof.name : t('Choose a file')}</span>
                        <span className="block text-xs text-gray-600 dark:text-slate-300">{t('JPG, PNG or PDF, up to 5 MB')}</span>
                    </span>
                </label>
                {form.errors.proof && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{t(form.errors.proof)}</span>}
            </div>

            {(form.errors.property_id || form.errors.months || form.errors.listings) && <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30">{t(form.errors.property_id || form.errors.months || form.errors.listings)}</p>}
            {form.errors.reference && <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30">{t(form.errors.reference)}</p>}

            <button disabled={form.processing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-3 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60">
                {form.processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {form.processing ? t('Sending…') : t('Send for checking · :amount', { amount: money(total) })}
            </button>
        </form>
    );
}

/** Bank transfer or cheque: reference plus a photo / PDF of the slip or cheque. */
// Banks in Rwanda, for the payer's bank (transfer) or the bank a cheque is drawn on.
export const RWANDA_BANKS = [
    'Bank of Kigali', 'BPR Bank Rwanda', 'I&M Bank Rwanda', 'Equity Bank Rwanda', 'Access Bank Rwanda', 'Ecobank Rwanda',
    'NCBA Bank Rwanda', 'Bank of Africa Rwanda', 'GT Bank Rwanda', 'Cogebanque', 'Zigama CSS', 'Development Bank of Rwanda (BRD)',
    'Urwego Bank', 'Unguka Bank', 'AB Bank Rwanda',
];

/** Bank transfer or cheque: the payer's bank details, the slip or cheque number, its date and a copy. */
export function TransferPay({ plan, method, total, money, bank, submitRoute = 'subscription.transfer' }) {
    const { t } = useTranslation();
    const isCheque = method === 'cheque';
    const today = localDateTime(new Date()).slice(0, 10);
    const form = useForm({ ...plan, method, bank_name: '', account_number: '', sender_name: '', reference: '', paid_at: today, proof: null });
    const [otherBank, setOtherBank] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [preview, setPreview] = useState(null);
    useEffect(() => { form.setData((current) => ({ ...current, ...plan, method })); }, [plan.property_id, plan.months, plan.listings, method]);
    useEffect(() => {
        const file = form.data.proof;
        if (!file || !(file.type || '').startsWith('image/')) { setPreview(null); return undefined; }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [form.data.proof]);

    const clientErrors = {};
    if (!form.data.bank_name.trim()) clientErrors.bank_name = isCheque ? t('Choose the bank the cheque is drawn on.') : t('Choose the bank you paid from.');
    if (!/^[0-9A-Za-z]{5,30}$/.test(form.data.account_number.replace(/[\s-]+/g, ''))) clientErrors.account_number = t('Enter the account number: letters and numbers only.');
    if (!form.data.sender_name.trim()) clientErrors.sender_name = isCheque ? t('Enter the name written on the cheque.') : t('Enter the name on the account (a person or a company).');
    if (isCheque ? !/^[0-9]{4,20}$/.test(form.data.reference.replace(/\s+/g, '')) : !form.data.reference.trim()) clientErrors.reference = isCheque ? t('Enter the cheque number: numbers only.') : t('Enter the reference number on the bank receipt.');
    if (!form.data.paid_at) clientErrors.paid_at = isCheque ? t('Enter the date written on the cheque.') : t('Enter the date of the transfer.');
    if (!form.data.proof) clientErrors.proof = isCheque ? t('Attach a copy (photo or scan) of the cheque.') : t('Attach the bank receipt (photo or PDF).');
    const errorFor = (field) => form.errors[field] || (submitted ? clientErrors[field] : null);
    const fieldClass = (field) => `mt-1.5 w-full rounded-xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-gray-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 ${errorFor(field) ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-300 dark:border-slate-600 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;
    const errorLine = (field) => errorFor(field) && <span className="mt-1 flex items-center gap-1 text-xs font-normal text-red-600 dark:text-red-400"><AlertCircle size={12} aria-hidden="true" />{t(errorFor(field))}</span>;

    const submit = (event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(clientErrors).length) return;
        form.post(route(submitRoute), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { form.reset('reference', 'proof'); setSubmitted(false); },
        });
    };

    return (
        <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 p-3 ring-1 ring-gray-200 dark:ring-slate-700 sm:p-4">
            <Step number={1} title={isCheque ? t('Write the cheque') : t('Pay to Q.R.A GROUP LTD')}>
                {isCheque ? (
                    <ul className="space-y-1.5 text-sm text-gray-800 dark:text-slate-100">
                        <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 flex-none text-emerald-600 dark:text-emerald-400" aria-hidden="true" />{t('Pay to the order of')} <strong>Q.R.A GROUP LTD</strong></li>
                        <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 flex-none text-emerald-600 dark:text-emerald-400" aria-hidden="true" />{t('Amount')}: <strong className="tabular-nums">{money(total)}</strong></li>
                        <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 flex-none text-emerald-600 dark:text-emerald-400" aria-hidden="true" />{t('Signed and dated, then give it to ITUZE or deposit it on our account.')}</li>
                    </ul>
                ) : (
                    <>
                        <p className="text-sm text-gray-700 dark:text-slate-200">{t('Transfer exactly :amount to this account:', { amount: money(total) })}</p>
                        {bank && (
                            <dl className="mt-3 grid gap-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10 p-3 text-sm sm:grid-cols-3">
                                {[[t('Bank'), bank.bank], [t('Account name'), bank.account_name], [t('Account number'), bank.account_number]].filter(([, value]) => value).map(([label, value]) => (
                                    <div key={label} className="min-w-0">
                                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">{label}</dt>
                                        <dd className="mt-0.5 flex items-center justify-between gap-2 font-semibold text-gray-900 dark:text-slate-100">
                                            <span className="min-w-0 break-words">{value}</span>
                                            <button type="button" onClick={() => navigator.clipboard?.writeText(value)} className="shrink-0 rounded-md bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-[#0E3B2E] dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">{t('Copy')}</button>
                                        </dd>
                                    </div>
                                ))}
                                {!bank.account_number && <p className="text-xs text-emerald-900 dark:text-emerald-300 sm:col-span-3">{t('Ask ITUZE GREEN PLATFORM for the account number before paying.')}</p>}
                            </dl>
                        )}
                    </>
                )}
            </Step>

            <Step number={2} title={isCheque ? t('Cheque details') : t('Your transfer details')}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                        {isCheque ? t('Bank of the cheque') : t('Your bank')}
                        <select value={otherBank ? '__other' : form.data.bank_name}
                            onChange={(event) => { const other = event.target.value === '__other'; setOtherBank(other); form.setData('bank_name', other ? '' : event.target.value); }}
                            className={fieldClass('bank_name')} aria-invalid={errorFor('bank_name') ? 'true' : undefined}>
                            <option value="">{t('Choose the bank')}</option>
                            {RWANDA_BANKS.map((name) => <option key={name} value={name}>{name}</option>)}
                            <option value="__other">{t('Other bank')}</option>
                        </select>
                        {otherBank && <input value={form.data.bank_name} onChange={(event) => form.setData('bank_name', event.target.value)} maxLength={80} placeholder={t('Name of the bank')} className={fieldClass('bank_name')} />}
                        {errorLine('bank_name')}
                    </label>
                    <label className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                        {isCheque ? t('Account number on the cheque') : t('Account number you paid from')}
                        <input value={form.data.account_number} onChange={(event) => form.setData('account_number', event.target.value.replace(/[^0-9A-Za-z\s-]/g, ''))} inputMode="numeric" maxLength={40}
                            placeholder="00040-0123456-78" className={`${fieldClass('account_number')} font-mono tracking-wide`} aria-invalid={errorFor('account_number') ? 'true' : undefined} />
                        {errorLine('account_number')}
                    </label>
                    <label className="block text-sm font-medium text-gray-800 dark:text-slate-100 sm:col-span-2">
                        {isCheque ? t('Name written on the cheque') : t('Name on the account')}
                        <input value={form.data.sender_name} onChange={(event) => form.setData('sender_name', event.target.value)} maxLength={150} autoComplete="organization"
                            placeholder={t('A person or a company, e.g. KAMANZI JEAN or IKAZE LTD')} className={fieldClass('sender_name')} aria-invalid={errorFor('sender_name') ? 'true' : undefined} />
                        {errorLine('sender_name')}
                    </label>
                    <label className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                        {isCheque ? t('Cheque number') : t('Reference number on the receipt')}
                        <input value={form.data.reference} onChange={(event) => form.setData('reference', isCheque ? event.target.value.replace(/[^\d\s]/g, '') : event.target.value)} maxLength={60}
                            inputMode={isCheque ? 'numeric' : 'text'} placeholder={isCheque ? '001234' : 'FT26298ABC12'} className={`${fieldClass('reference')} font-mono tracking-wide`} aria-invalid={errorFor('reference') ? 'true' : undefined} />
                        {!isCheque && <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">{t('Also called transaction ID or FT number.')}</span>}
                        {errorLine('reference')}
                    </label>
                    <label className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                        {isCheque ? t('Date on the cheque') : t('Date of the transfer')}
                        <input type="date" value={form.data.paid_at} max={today} onChange={(event) => form.setData('paid_at', event.target.value)} className={fieldClass('paid_at')} aria-invalid={errorFor('paid_at') ? 'true' : undefined} />
                        {errorLine('paid_at')}
                    </label>
                    <div className="sm:col-span-2">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{t('Amount')}</p>
                        <p className="mt-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-4 py-2.5 text-sm font-bold tabular-nums text-gray-900 dark:text-slate-100">{money(total)}</p>
                    </div>
                </div>
                {(form.errors.property_id || form.errors.months || form.errors.listings) && <p className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30">{t(form.errors.property_id || form.errors.months || form.errors.listings)}</p>}
            </Step>

            <Step number={3} title={isCheque ? t('Copy of the cheque') : t('Bank receipt')}>
                <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-3 transition focus-within:ring-2 focus-within:ring-[#0E3B2E]/30 ${form.data.proof ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/10' : errorFor('proof') ? 'border-red-300 dark:border-red-500/40 bg-red-50/40 dark:bg-red-500/10' : 'border-gray-300 dark:border-slate-600 hover:border-[#0E3B2E]/40 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => form.setData('proof', event.target.files?.[0] || null)} />
                    <span className="flex h-16 w-24 flex-none items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-slate-900 ring-1 ring-gray-200 dark:ring-slate-700" aria-hidden="true">
                        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : form.data.proof ? <FileCheck2 size={22} className="text-[#0E3B2E] dark:text-emerald-300" /> : <Upload size={22} className="text-gray-400 dark:text-slate-500" />}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900 dark:text-slate-100">{form.data.proof ? form.data.proof.name : isCheque ? t('Add a photo or scan of the cheque') : t('Add a photo or PDF of the receipt')}</span>
                        <span className="block text-xs text-gray-600 dark:text-slate-300">{t('JPG, PNG or PDF, up to 5 MB')} · {t('every number must be readable')}</span>
                    </span>
                </label>
                {errorLine('proof')}
            </Step>

            <button disabled={form.processing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#124B3A] disabled:opacity-60">
                {form.processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {form.processing ? t('Sending…') : t('Send for checking · :amount', { amount: money(total) })}
            </button>
            <p className="text-center text-xs text-gray-500 dark:text-slate-400">{t('ITUZE checks it with the bank, usually within one working day. You get an SMS and an email.')}</p>
        </form>
    );
}

/** A numbered block of the bank or cheque form. */
function Step({ number, title, children }) {
    return (
        <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-slate-100">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0E3B2E] text-xs text-white" aria-hidden="true">{number}</span>{title}
            </h3>
            {children}
        </section>
    );
}
