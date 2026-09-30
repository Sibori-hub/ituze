import { useTranslation } from '@/localization';

const paymentMethods = ['cash', 'mobile_money', 'bank_transfer', 'other'];

const paymentMethodLabels = {
    cash: 'Cash',
    mobile_money: 'Mobile money',
    bank_transfer: 'Bank transfer',
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
    const requiresPaymentReference = ['mobile_money', 'bank_transfer'].includes(paymentMethod);

    return (
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <div>
                <label className="block text-sm font-medium text-gray-700">{t('Agreement reference')}</label>
                <p className="mt-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
                    {t('Generated automatically after saving')}
                </p>
            </div>
            <label className="block text-sm font-medium text-gray-700">
                {t(isDepositPayment ? 'Deposit payment method' : 'Payment method')}
                <select
                    required
                    value={paymentMethod}
                    onChange={event => {
                        onPaymentMethodChange(event.target.value);
                        if (!['mobile_money', 'bank_transfer'].includes(event.target.value)) {
                            onPaymentReferenceChange('');
                        }
                    }}
                    className="mt-1.5 w-full rounded-xl border-gray-200"
                >
                    <option value="">{t('Select a payment method')}</option>
                    {paymentMethods.map(method => (
                        <option key={method} value={method}>{t(paymentMethodLabels[method])}</option>
                    ))}
                </select>
                {errors.payment_method && <span className="mt-1 block text-xs text-red-600">{errors.payment_method}</span>}
                {isDepositPayment && <span className="mt-1 block text-xs font-normal text-gray-500">{t('The full deposit is recorded as received; rent is allocated from it and the remaining deposit credit is calculated automatically.')}</span>}
            </label>
            {requiresPaymentReference && (
                <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
                    {t(paymentMethod === 'mobile_money' ? 'Mobile money transaction ID' : 'Bank payment reference')}
                    <input
                        required
                        value={paymentReference}
                        onChange={event => onPaymentReferenceChange(event.target.value)}
                        maxLength={255}
                        className="mt-1.5 w-full rounded-xl border-gray-200"
                    />
                    {errors.payment_reference && <span className="mt-1 block text-xs text-red-600">{errors.payment_reference}</span>}
                </label>
            )}
        </div>
    );
}
