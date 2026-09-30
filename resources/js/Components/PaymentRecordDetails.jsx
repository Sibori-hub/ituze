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
        <div className="min-w-0 rounded-lg border border-gray-100 bg-white/80 p-2.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-gray-800">
                <Receipt size={13} className="shrink-0 text-[#0E3B2E]" />
                {Number(payment.amount).toLocaleString(localeForLanguage(language))} RWF
                <span className="font-normal text-gray-500">· {t(payment.method.replace(/_/g, ' ').replace(/^./, character => character.toUpperCase()))}</span>
            </p>
            {payment.vat_amount !== undefined && (
                <p className="mt-1 text-gray-600">
                    {payment.vat_amount === null
                        ? t('VAT breakdown not recorded')
                        : <>{t('VAT at :rate% of amount', { rate: payment.vat_rate })}: {Number(payment.vat_amount).toLocaleString(localeForLanguage(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF</>}
                </p>
            )}
            <p className="mt-1 break-all text-gray-600">
                {t('App receipt number')}: <span className="font-medium text-[#0E3B2E]">{payment.receipt_number || t('Receipt pending')}</span>
            </p>
            <p className="mt-1 break-all text-gray-600">
                {t('External transaction reference')}: {payment.reference || <span className="italic text-gray-400">{t('No transaction reference recorded')}</span>}
            </p>
            <p className="mt-1 text-gray-500">{formatDateTime(payment.paid_at, language)}</p>
            {payment.notes && <p className="mt-1 break-words text-gray-600">{payment.notes}</p>}
        </div>
    );
}
