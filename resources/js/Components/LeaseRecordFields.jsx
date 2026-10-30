import { useTranslation } from '@/localization';

const paymentMethods = ['cash', 'mobile_money', 'bank_transfer', 'cheque', 'other'];

const paymentMethodLabels = {
    cash: 'Cash',
    mobile_money: 'Mobile money',
    bank_transfer: 'Bank transfer',
    cheque: 'Cheque',
    other: 'Other',
};

export default function LeaseRecordFields({
    paymentMethod,
    onPaymentMethodChange,
    paymentReference,
    onPaymentReferenceChange,
    errors = {},
    isDepositPayment = false,
}) {
    const { t } = useTranslation();
    const requiresPaymentReference = ['mobile_money', 'bank_transfer', 'cheque'].includes(paymentMethod);

    return (
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">{t('Agreement reference')}</label>
                <p className="mt-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-3 py-2.5 text-sm text-gray-600 dark:text-slate-300">
                    {t('Generated automatically after saving')}
                </p>
            </div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                {t(isDepositPayment ? 'Deposit payment method' : 'Payment method')}
                <select
                    required
                    value={paymentMethod}
                    onChange={event => {
                        onPaymentMethodChange(event.target.value);
                        if (!['mobile_money', 'bank_transfer', 'cheque'].includes(event.target.value)) {
                            onPaymentReferenceChange('');
                        }
                    }}
                    className="mt-1.5 w-full rounded-xl border-gray-200 dark:border-slate-700"
                >
                    <option value="">{t('Select a payment method')}</option>
                    {paymentMethods.map(method => (
                        <option key={method} value={method}>{t(paymentMethodLabels[method])}</option>
                    ))}
                </select>
                {errors.payment_method && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors.payment_method}</span>}
                {isDepositPayment && <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">{t('Monthly rentals: the tenant pays 2 months of rent and a 1-month security deposit now. The deposit is kept until move-out.')}</span>}
            </label>
            {requiresPaymentReference && (
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 sm:col-span-2">
                    {t(({ mobile_money: 'Mobile money transaction ID', bank_transfer: 'Bank slip reference', cheque: 'Cheque number' })[paymentMethod])}
                    <input
                        required
                        value={paymentReference}
                        onChange={event => onPaymentReferenceChange(event.target.value)}
                        maxLength={255}
                        className="mt-1.5 w-full rounded-xl border-gray-200 dark:border-slate-700"
                    />
                    {errors.payment_reference && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors.payment_reference}</span>}
                </label>
            )}
        </div>
    );
}
