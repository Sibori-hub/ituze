import { useRef } from 'react';
import { Printer } from 'lucide-react';
import { useTranslation } from '@/localization';

const localeForLanguage = language => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

const formatDateTime = (value, language) => {
    if (!value) return '—';
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(localeForLanguage(language), {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);
};

export default function PaymentReceiptButton({ payment, payments = [payment], charge, tenant, property, unit, agreement }) {
    const { t, language } = useTranslation();
    const receiptRef = useRef(null);
    const locale = localeForLanguage(language);
    const totalAmount = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalVat = payments.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0);
    const totalTaxable = payments.reduce((sum, item) => sum + Number(item.taxable_amount || 0), 0);
    const isCombined = payments.length > 1;

    const printReceipt = () => {
        const receipt = receiptRef.current;
        if (!receipt) return;

        const cleanup = () => {
            receipt.classList.remove('print-active');
            delete document.body.dataset.printTarget;
        };

        receipt.classList.add('print-active');
        document.body.dataset.printTarget = 'payment-receipt';
        window.addEventListener('afterprint', cleanup, { once: true });
        window.print();
    };

    return (
        <>
            <button
                type="button"
                onClick={printReceipt}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#0E3B2E]/20 bg-white px-3 py-2 text-xs font-semibold text-[#0E3B2E] transition hover:bg-emerald-50"
            >
                <Printer size={14} />
                {t('Print receipt')}
            </button>
            <section ref={receiptRef} data-payment-receipt className="hidden">
                <div className="payment-receipt-content mx-auto max-w-2xl bg-white p-8 font-sans text-gray-900">
                    <header className="flex items-center gap-4 border-b-2 border-[#0E3B2E] pb-5">
                        <img src="/images/logo.png" alt="Ituze-Qra Ltd" className="h-16 w-16 object-contain" />
                        <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-[#0E3B2E]">{t('Ituze-Qra Ltd')}</p>
                            <h1 className="mt-1 text-2xl font-bold">{t('Payment receipt')}</h1>
                        </div>
                    </header>
                    <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">{t('App receipt number')}</p>
                            <p className="mt-1 text-lg font-bold text-[#0E3B2E]">{payment.receipt_number || t('Receipt pending')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs uppercase tracking-wide text-gray-500">{t('Date paid')}</p>
                            <p className="mt-1 font-semibold">{formatDateTime(payment.paid_at, language)}</p>
                        </div>
                    </div>
                    <dl className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
                        {[
                            [t('Received from'), tenant?.name || '—'],
                            [t('Agreement ID'), agreement?.reference || '—'],
                            [t('Property / unit'), `${property?.name || '—'} · ${t('Unit')} ${unit?.unit_number || '—'}`],
                            [t('Charge'), isCombined ? t('Combined rent payment') : t(charge.charge_type)],
                            [t('Payment method'), t(payment.method.replace(/_/g, ' ').replace(/^./, character => character.toUpperCase()))],
                            [t('External transaction reference'), payment.reference || t('No transaction reference recorded')],
                        ].map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 py-3 text-sm">
                                <dt className="text-gray-500">{label}</dt>
                                <dd className="break-words text-right font-medium">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {isCombined && (
                        <div className="mt-5 rounded-xl bg-gray-50 px-5 py-4 text-sm">
                            <p className="font-semibold text-gray-800">{t('Periods included')}</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600">
                                {payments.map(item => <li key={item.id}>{item.charge.period_label || t('Rent period')} — {Number(item.amount).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF</li>)}
                            </ul>
                        </div>
                    )}
                    {(charge.charge_type === 'rent' || isCombined) && (
                        <dl className="mt-5 space-y-2 rounded-xl bg-gray-50 px-5 py-4 text-sm">
                            {payments.some(item => item.vat_amount === null || item.vat_amount === undefined) ? (
                                <p>{t('VAT breakdown not recorded')}</p>
                            ) : (
                                <>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-gray-600">{t('Recorded rent amount')}</dt>
                                        <dd className="font-medium">{totalTaxable.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-gray-600">{t('VAT at :rate% of amount', { rate: payment.vat_rate })}</dt>
                                        <dd className="font-medium">{totalVat.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF</dd>
                                    </div>
                                </>
                            )}
                        </dl>
                    )}
                    <div className="mt-6 flex items-center justify-between rounded-xl bg-emerald-50 px-5 py-4">
                        <span className="font-semibold">{t('Amount received')}</span>
                        <span className="text-xl font-bold text-[#0E3B2E]">
                            {totalAmount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF
                        </span>
                    </div>
                    {payment.notes && <p className="mt-5 text-sm text-gray-600"><span className="font-semibold">{t('Note')}:</span> {payment.notes}</p>}
                    <p className="mt-10 border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
                        {t('Thank you for your payment.')}
                        <span className="mt-2 block">{t('This payment receipt is not a VAT invoice or tax return.')}</span>
                    </p>
                </div>
            </section>
        </>
    );
}
