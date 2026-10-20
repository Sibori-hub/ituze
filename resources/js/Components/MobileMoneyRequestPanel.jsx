import RwandaFlag from '@/Components/RwandaFlag';
import { formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { useTranslation } from '@/localization';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Send, Smartphone, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { csrfFetch } from '@/lib/csrf';


const call = async (url, options = {}) => {
    const res = await csrfFetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(options.headers || {}) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const first = json?.errors ? Object.values(json.errors)[0] : null;
        throw new Error((Array.isArray(first) ? first[0] : first) || json?.message || 'Request failed');
    }
    return json;
};

/**
 * Push the payment to the tenant's phone (MTN MoMo / Airtel Money "request to
 * pay") and follow it until they approve with their PIN. When approved, the
 * request id becomes the proof of payment for the assignment.
 */
export default function MobileMoneyRequestPanel({ tenant, unit, amountLabel, onPaid, onReset, extraPayload = {} }) {
    const { t } = useTranslation();
    const [phone, setPhone] = useState(toLocalDigits(tenant.phone || ''));
    const [request, setRequest] = useState(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [now, setNow] = useState(Date.now());
    // Counted on this device from when the request was sent, so clock differences with the server do not matter.
    const [deadline, setDeadline] = useState(null);
    const poll = useRef(null);

    const phoneValid = RWANDA_MOBILE_REGEX.test(phone);
    const status = request?.status;

    const stopPolling = () => {
        clearInterval(poll.current);
        poll.current = null;
    };
    useEffect(() => stopPolling, []);

    // A different unit means a different amount: start again.
    useEffect(() => {
        stopPolling();
        setRequest(null);
        setError('');
    }, [unit?.id]);

    useEffect(() => {
        if (status !== 'pending') return undefined;
        const tick = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(tick);
    }, [status]);

    const follow = (id) => {
        stopPolling();
        poll.current = setInterval(async () => {
            try {
                const { request: latest } = await call(route('mobile-money.requests.show', id));
                setRequest(latest);
                if (latest.status !== 'pending') {
                    stopPolling();
                    if (latest.status === 'successful') onPaid(latest);
                }
            } catch {
                // Keep trying; a slow network should not cancel the payment.
            }
        }, 3000);
    };

    const send = async () => {
        setError('');
        if (!phoneValid) {
            setError(t('Enter 10 digits starting with 078, 079, 072, or 073.'));
            return;
        }
        setSending(true);
        onReset();
        try {
            const { request: created } = await call(route('mobile-money.requests.store'), {
                method: 'POST',
                body: JSON.stringify({ tenant_id: tenant.id, unit_id: unit.id, phone: `0${phone}`, ...extraPayload }),
            });
            setRequest(created);
            setDeadline(Date.now() + (new Date(created.expires_at).getTime() - new Date(created.created_at).getTime()));
            follow(created.id);
        } catch (e) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    };

    const again = () => {
        stopPolling();
        setRequest(null);
        onReset();
    };

    const secondsLeft = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : 0;
    const testMode = request ? request.provider === 'fake' || request.currency !== 'RWF' : false;

    if (status === 'successful') {
        return (
            <div className="animate-pop-in rounded-2xl border border-green-200 bg-green-50 p-4" role="status">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-green-600 text-white"><CheckCircle2 size={22} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-green-900">{t('Paid on the phone')}</p>
                        <p className="mt-0.5 text-sm text-green-900/80">{t(':amount received from +:phone.', { amount: amountLabel, phone: request.phone })}</p>
                        <p className="mt-1 font-mono text-xs text-green-900/80">{t('Transaction ID')}: {request.transaction_id}</p>
                        {testMode && <TestBadge />}
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'pending') {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status" aria-live="polite">
                <div className="flex items-start gap-3">
                    <span className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full bg-amber-500 text-white">
                        <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-40" aria-hidden="true" />
                        <Smartphone size={20} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-amber-950">{t('Waiting for the tenant to approve on their phone…')}</p>
                        <p className="mt-0.5 text-sm text-amber-900/80">{t('A prompt for :amount was sent to +:phone. They approve it with their mobile money PIN.', { amount: amountLabel, phone: request.phone })}</p>
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-900">
                            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                            {t('Time left: :time', { time: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` })}
                        </p>
                        {testMode && <TestBadge />}
                    </div>
                </div>
                <button type="button" onClick={again} className="mt-3 text-xs font-semibold text-amber-900 underline underline-offset-2">{t('Cancel and use another number')}</button>
            </div>
        );
    }

    if (status === 'failed' || status === 'expired') {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-red-600 text-white"><XCircle size={22} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-red-900">{status === 'expired' ? t('The request expired') : t('The payment was not completed')}</p>
                        <p className="mt-0.5 text-sm text-red-900/80">{request.failure_reason ? t(request.failure_reason) : t('Nothing was charged.')}</p>
                    </div>
                </div>
                <button type="button" onClick={again} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-800 ring-1 ring-red-200 hover:bg-red-100">
                    <RotateCcw size={15} aria-hidden="true" />{t('Try again')}
                </button>
            </div>
        );
    }

    if (!unit) {
        return (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700" role="status">
                <Smartphone size={18} className="mt-0.5 flex-none text-gray-400" aria-hidden="true" />
                {t('Choose the unit in step 1 first. The amount to request depends on its rent.')}
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <label htmlFor="momo-phone" className="block text-sm font-medium text-gray-800">{t('Tenant’s mobile money number')}</label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <div className={`flex flex-1 items-stretch overflow-hidden rounded-xl border bg-white shadow-sm focus-within:ring-2 ${phone !== '' && !phoneValid ? 'border-red-400 focus-within:ring-red-500/20' : 'border-gray-300 focus-within:border-[#0E3B2E] focus-within:ring-[#0E3B2E]/15'}`}>
                    <span className="flex select-none items-center gap-2 border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700">
                        <RwandaFlag className="h-[15px] w-[22px]" />+250
                    </span>
                    <input id="momo-phone" type="tel" inputMode="numeric" autoComplete="off" value={formatPhone(phone)} placeholder="788 123 456"
                        onChange={e => setPhone(toLocalDigits(e.target.value))}
                        className="w-full min-w-0 border-0 bg-transparent px-3 py-2.5 text-sm tracking-wide text-gray-900 focus:ring-0" />
                </div>
                <button type="button" onClick={send} disabled={sending || !unit}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFCB05] px-5 py-2.5 text-sm font-bold text-gray-900 shadow-sm transition-colors hover:bg-[#f2bf00] disabled:opacity-60">
                    {sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                    {t('Send payment request')}
                </button>
            </div>
            <p className={`mt-1.5 text-xs ${phone !== '' && !phoneValid ? 'text-red-600' : 'text-gray-500'}`}>
                {phoneValid ? t(':network number', { network: getNetwork(phone) }) : t('Enter 10 digits starting with 078, 079, 072, or 073.')}
                {' · '}{t('The tenant receives a prompt for :amount and approves it with their PIN.', { amount: amountLabel })}
            </p>
            {error && <p className="mt-2 flex items-start gap-1.5 text-sm text-red-600" role="alert"><AlertCircle size={15} className="mt-0.5 flex-none" aria-hidden="true" />{t(error)}</p>}
        </div>
    );
}

function TestBadge() {
    const { t } = useTranslation();

    return (
        <span className="mt-2 flex w-fit rounded-full bg-gray-900/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            {t('Test mode · no real money')}
        </span>
    );
}
