import { Receipt } from 'lucide-react';
import { useTranslation } from '@/localization';

const localeForLanguage = language => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

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

export default function PaymentRecordDetails({ payment }) {
    const { t, language } = useTranslation();

    return (
        <div className="min-w-0 rounded-lg border border-gray-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-2.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-100">
                <Receipt size={13} className="shrink-0 text-[#0E3B2E] dark:text-emerald-300" />
                {Number(payment.amount).toLocaleString(localeForLanguage(language))} RWF
                <span className="font-normal text-gray-500 dark:text-slate-400">· {t(payment.method.replace(/_/g, ' ').replace(/^./, character => character.toUpperCase()))}</span>
            </p>
            {payment.vat_amount !== undefined && (
                <p className="mt-1 text-gray-600 dark:text-slate-300">
                    {payment.vat_amount === null
                        ? t('VAT breakdown not recorded')
                        : <>{t('VAT at :rate% of amount', { rate: payment.vat_rate })}: {Number(payment.vat_amount).toLocaleString(localeForLanguage(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF</>}
                </p>
            )}
            <p className="mt-1 break-all text-gray-600 dark:text-slate-300">
                {t('App receipt number')}: <span className="font-medium text-[#0E3B2E] dark:text-emerald-300">{payment.receipt_number || t('Receipt pending')}</span>
            </p>
            <p className="mt-1 break-all text-gray-600 dark:text-slate-300">
                {t('External transaction reference')}: {payment.reference || <span className="italic text-gray-400 dark:text-slate-500">{t('No transaction reference recorded')}</span>}
            </p>
            {payment.payer_name && (
                <p className="mt-1 break-words text-gray-600 dark:text-slate-300">
                    {t('Paid by')}: <span className="font-medium text-gray-800 dark:text-slate-100">{payment.payer_name}</span>{payment.payer_phone ? ` · ${payment.payer_phone}` : ''}
                </p>
            )}
            {payment.proof_url && (
                <a href={payment.proof_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-[#0E3B2E] dark:text-emerald-300 underline underline-offset-2">{t('View MoMo SMS screenshot')}</a>
            )}
            <p className="mt-1 text-gray-500 dark:text-slate-400">{formatDateTime(payment.paid_at, language)}</p>
            {payment.notes && <p className="mt-1 break-words text-gray-600 dark:text-slate-300">{payment.notes}</p>}
        </div>
    );
}
