import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Clock3, CreditCard, Receipt } from 'lucide-react';
import { useTranslation } from '@/localization';

const tabs = [
    ['all', 'All charges'],
    ['outstanding', 'Outstanding'],
    ['overdue', 'Overdue'],
    ['paid', 'Paid'],
];

const today = () => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const localeForLanguage = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

const formatDate = (value, language) => {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(localeForLanguage(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

const formatDateTime = (value, language) => {
    if (!value) return '—';
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(localeForLanguage(language), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);
};

function ChargeCard({ charge }) {
    const { t, language } = useTranslation();
    const tenancy = charge.tenancy;
    const property = tenancy?.unit?.property;
    const unit = tenancy?.unit;
    const payments = charge.payments || [];
    const paid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balance = charge.voided_at ? 0 : Math.max(0, Number(charge.amount) - paid);
    const overdue = !charge.voided_at && balance > 0 && String(charge.due_date).slice(0, 10) < today();
    const paidAt = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const form = useForm({ amount: balance.toFixed(2), method: 'cash', paid_at: paidAt, reference: '', notes: '' });

    const submit = (event) => {
        event.preventDefault();
        form.post(route('properties.units.tenancy.payments.store', [property.id, unit.id, tenancy.id, charge.id]), {
            preserveScroll: true,
            onSuccess: () => form.reset('reference', 'notes'),
        });
    };

    return (
        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="font-semibold capitalize text-gray-900">{t(charge.charge_type)} · {tenancy?.tenant?.name || t('Tenant')}</p>
                    <p className="mt-1 text-sm text-gray-500">{property?.name || t('Property')} · {t('Unit')} {unit?.unit_number || '—'}</p>
                    <p className="mt-1 text-xs text-gray-500">
                        {formatDate(charge.period_start, language)}{charge.period_end ? ` – ${formatDate(charge.period_end, language)}` : ''} · {t('Due')} {formatDate(charge.due_date, language)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-[Sora] text-lg font-bold text-gray-900">{Number(charge.amount).toLocaleString(localeForLanguage(language))} RWF</p>
                    <p className={`mt-1 text-xs font-semibold ${charge.voided_at ? 'text-gray-500' : overdue ? 'text-red-600' : balance ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {charge.voided_at ? t('Cancelled') : balance ? `${t(overdue ? 'Overdue' : 'Remaining')}: ${balance.toLocaleString(localeForLanguage(language))} RWF` : t('Paid in full')}
                    </p>
                </div>
            </div>
            {payments.length > 0 && (
                <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-3">
                    {payments.map(payment => (
                        <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                            <span className="inline-flex items-center gap-1.5"><Receipt size={13} />{Number(payment.amount).toLocaleString(localeForLanguage(language))} RWF · {t(payment.method.replace(/_/g, ' '))} · {formatDateTime(payment.paid_at, language)}</span>
                            <span className="font-semibold text-[#0E3B2E]">{payment.receipt_number || payment.reference || t('Payment')}</span>
                        </div>
                    ))}
                </div>
            )}
            {balance > 0 && !charge.voided_at && (
                <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-gray-100 p-4 sm:grid-cols-2">
                    <label className="text-xs font-medium text-gray-600">{t('Amount (max :amount RWF)', { amount: balance.toLocaleString(localeForLanguage(language)) })}
                        <input type="number" min="0.01" max={balance.toFixed(2)} step="0.01" required value={form.data.amount} onChange={event => form.setData('amount', event.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                        {form.errors.amount && <span className="mt-1 block text-red-600">{form.errors.amount}</span>}
                    </label>
                    <label className="text-xs font-medium text-gray-600">{t('Payment method')}
                        <select value={form.data.method} onChange={event => form.setData('method', event.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm">
                            <option value="cash">{t('Cash')}</option><option value="bank_transfer">{t('Bank transfer')}</option><option value="mobile_money">{t('Mobile money')}</option><option value="other">{t('Other')}</option>
                        </select>
                    </label>
                    <label className="text-xs font-medium text-gray-600">{t('Received at')}
                        <input type="datetime-local" required value={form.data.paid_at} onChange={event => form.setData('paid_at', event.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-gray-600">{t('Reference (optional)')}
                        <input value={form.data.reference} onChange={event => form.setData('reference', event.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-gray-600 sm:col-span-2">{t('Payment note (optional)')}
                        <input value={form.data.notes} onChange={event => form.setData('notes', event.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                    </label>
                    <button type="submit" disabled={form.processing} className="rounded-lg bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a2e23] disabled:opacity-50 sm:col-span-2">
                        {form.processing ? t('Saving payment…') : t('Record payment')}
                    </button>
                </form>
            )}
        </article>
    );
}

export default function PaymentsIndex({ charges, filters }) {
    const { t } = useTranslation();
    const status = filters.status || 'all';
    const changeFilter = (value) => router.get(route('payments.index'), { status: value }, { preserveState: true, replace: true });

    return (
        <AuthenticatedLayout header="Payments">
            <Head title="Payments" />
            <div className="mb-6">
                <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Rent & deposit payments')}</h1>
                <p className="mt-1 text-sm text-gray-500">{t('Track charges, record partial or full payments, and issue receipts.')}</p>
            </div>
            <nav className="mb-5 flex flex-wrap gap-2" aria-label="Filter charges">
                {tabs.map(([value, label]) => (
                    <button key={value} type="button" onClick={() => changeFilter(value)} className={`rounded-xl px-4 py-2 text-sm font-medium ${status === value ? 'bg-[#0E3B2E] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-[#0E3B2E]/30'}`}>{t(label)}</button>
                ))}
            </nav>
            {charges.data.length ? (
                <div className="space-y-4">{charges.data.map(charge => <ChargeCard key={charge.id} charge={charge} />)}</div>
            ) : (
                <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
                    {status === 'paid' ? <CheckCircle2 size={36} className="mx-auto text-emerald-500" /> : <Clock3 size={36} className="mx-auto text-gray-300" />}
                    <h2 className="mt-3 font-semibold text-gray-900">{status === 'all' ? t('No charges found') : t('No :status charges found', { status: t(status) })}</h2>
                    <p className="mt-1 text-sm text-gray-500">{t('Rent and deposit charges are created from the tenancy schedule.')}</p>
                    <Link href={route('properties.index')} className="mt-4 inline-flex text-sm font-semibold text-[#0E3B2E] hover:underline">{t('View properties')}</Link>
                </div>
            )}
            {charges.links?.length > 3 && (
                <div className="mt-5 flex flex-wrap gap-2">
                    {charges.links.map((link, index) => <button key={index} type="button" disabled={!link.url} onClick={() => link.url && router.visit(link.url)} className={`rounded-lg px-3 py-1.5 text-sm ${link.active ? 'bg-[#0E3B2E] text-white' : 'bg-white text-gray-600'} ${!link.url ? 'opacity-40' : ''}`} dangerouslySetInnerHTML={{ __html: link.label }} />)}
                </div>
            )}
        </AuthenticatedLayout>
    );
}
