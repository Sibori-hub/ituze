import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import LeaseNoteField from '@/Components/LeaseNoteField';
import LeaseRecordFields from '@/Components/LeaseRecordFields';
import PaymentRecordDetails from '@/Components/PaymentRecordDetails';
import PaymentReceiptButton from '@/Components/PaymentReceiptButton';
import { ArrowLeft, Home, DollarSign, Edit, MapPin, Upload, Download, Trash2, FileText, CalendarClock, Receipt, ClipboardCheck } from 'lucide-react';
import { useTranslation } from '@/localization';

const statusStyles = {
    available: 'bg-green-50 text-green-700 ring-1 ring-green-600/10',
    occupied: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10',
    maintenance: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10',
    reserved: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/10',
    inactive: 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/10',
};

const today = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const inputDate = (date) => {
    const [year, month, day] = String(date).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
};

const formatDate = (value, locale = undefined) => {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

const formatDateTime = (value, locale = undefined) => {
    if (!value) return '—';
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);
};

function ChargeRow({ charge, property, unit, tenancy }) {
    const { t, language } = useTranslation();
    const locale = { en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' }[language];
    const paid = (charge.payments || []).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balance = charge.voided_at ? 0 : Math.max(0, Number(charge.amount) - paid);
    const dueDate = String(charge.due_date).slice(0, 10);
    const isOverdue = !charge.voided_at && balance > 0 && dueDate < today();
    const isUpcoming = balance > 0 && dueDate > today();
    const form = useForm({
        amount: balance.toFixed(2),
        method: 'cash',
        paid_at: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        reference: '',
        notes: '',
    });

    const recordPayment = (event) => {
        event.preventDefault();
        form.post(route('properties.units.tenancy.payments.store', [property, unit, tenancy.id, charge.id]), {
            preserveScroll: true,
            onSuccess: () => form.reset('reference', 'notes'),
        });
    };

    return (
        <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="font-semibold capitalize text-gray-900">{t(':type charge', { type: t(charge.charge_type) })}</p>
                    <p className="mt-1 text-xs text-gray-500">
                        {formatDate(charge.period_start, locale)}{charge.period_end ? ` – ${formatDate(charge.period_end, locale)}` : ''} · {t('Due')} {formatDate(charge.due_date, locale)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-gray-900">{Number(charge.amount).toLocaleString()} RWF</p>
                    <p className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : balance ? 'text-amber-700' : 'text-green-700'}`}>
                        {charge.voided_at ? t('Cancelled') : balance ? `${t(isOverdue ? 'Overdue' : isUpcoming ? 'Upcoming' : 'Due')}: ${balance.toLocaleString()} RWF` : t('Paid in full')}
                    </p>
                </div>
            </div>
            {charge.payments?.length > 0 && (
                <div className="space-y-1 rounded-xl bg-gray-50 p-3">
                    {charge.payments.map(payment => <PaymentRecordDetails key={payment.id} payment={{ ...payment, charge_type: charge.charge_type }} />)}
                </div>
            )}
            {balance > 0 && !charge.voided_at && charge.charge_type !== 'rent' && (
                <form onSubmit={recordPayment} className="grid gap-2 rounded-xl border border-gray-100 bg-white p-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-gray-600">{t('Payment amount')}
                        <input type="number" min="0.01" max={balance.toFixed(2)} step="0.01" required value={form.data.amount} onChange={e => form.setData('amount', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-gray-600">{t('Method')}
                        <select value={form.data.method} onChange={e => form.setData('method', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm">
                            <option value="cash">{t('Cash')}</option><option value="bank_transfer">{t('Bank transfer')}</option><option value="mobile_money">{t('Mobile money')}</option><option value="other">{t('Other')}</option>
                        </select>
                    </label>
                    <label className="text-xs font-medium text-gray-600">{t('Paid at')}
                        <input type="datetime-local" required value={form.data.paid_at} onChange={e => form.setData('paid_at', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-gray-600">{t(['bank_transfer', 'mobile_money'].includes(form.data.method) ? 'Bank / Mobile Money transaction ID' : 'Reference (optional)')}
                        <input required={['bank_transfer', 'mobile_money'].includes(form.data.method)} value={form.data.reference} onChange={e => form.setData('reference', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                        {form.errors.reference && <span className="mt-1 block text-red-600">{form.errors.reference}</span>}
                    </label>
                    {form.errors.amount && <p className="text-xs text-red-600 sm:col-span-2">{form.errors.amount}</p>}
                    <button disabled={form.processing} className="rounded-lg bg-[#0E3B2E] px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2">
                        {form.processing ? t('Saving payment…') : t('Record payment')}
                    </button>
                </form>
            )}
        </div>
    );
}

function TenancyManager({ tenancy, property, unit }) {
    const { t, language } = useTranslation();
    const locale = { en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' }[language];
    const todayDate = today();
    const nextStartDate = tenancy.end_date
        ? inputDate(new Date(new Date(tenancy.end_date).getTime() + 86400000).toISOString().slice(0, 10))
        : todayDate;
    const renewalStart = nextStartDate > todayDate ? nextStartDate : todayDate;
    const renewalForm = useForm({
        start_date: renewalStart,
        end_date: '',
        monthly_rent: tenancy.monthly_rent,
        rent_frequency: tenancy.rent_frequency || 'monthly',
        due_day: tenancy.due_day || '1',
        lease: null,
        lease_notes: '',
        payment_method: '',
        payment_reference: '',
    });
    const depositReceived = Number(tenancy.deposit_received_amount || 0);
    const outstandingRentCharges = (tenancy.rent_charges || [])
        .filter(charge => charge.charge_type === 'rent' && !charge.voided_at)
        .map(charge => {
            const paid = (charge.payments || []).reduce((sum, payment) => sum + Number(payment.amount), 0);

            return { ...charge, balance: Math.max(0, Number(charge.amount) - paid) };
        })
        .filter(charge => charge.balance > 0)
        .sort((first, second) => first.due_date.localeCompare(second.due_date));
    const outstandingRentCents = outstandingRentCharges.reduce(
        (sum, charge) => sum + Math.round(charge.balance * 100),
        0,
    );
    const rentPaymentForm = useForm({
        amount: (outstandingRentCents / 100).toFixed(2),
        method: 'cash',
        paid_at: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        reference: '',
        notes: '',
    });
    const moveOutForm = useForm({
        move_out_date: todayDate,
        condition_notes: '',
        damage_cost: '0.00',
        deduction_notes: '',
        unit_outcome: 'available',
    });
    const damageCost = Math.max(0, Number(moveOutForm.data.damage_cost) || 0);
    const depositRefund = Math.max(0, depositReceived - damageCost);
    const damageDue = Math.max(0, damageCost - depositReceived);
    const leaseForm = useForm({ lease: null, notes: '', payment_method: '', payment_reference: '' });

    const submitLease = (event) => {
        event.preventDefault();
        leaseForm.post(route('properties.units.tenancy.leases.store', [property, unit, tenancy.id]), {
            forceFormData: true,
            onSuccess: () => leaseForm.reset(),
        });
    };
    const submitRenewal = (event) => {
        event.preventDefault();
        renewalForm.post(route('properties.units.tenancy.renewals.store', [property, unit, tenancy.id]), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => renewalForm.reset(),
        });
    };
    const submitMoveOut = (event) => {
        event.preventDefault();
        moveOutForm.post(route('properties.units.tenancy.move-out', [property, unit, tenancy.id]), {
            preserveScroll: true,
        });
    };
    const submitRentPayment = (event) => {
        event.preventDefault();
        rentPaymentForm.post(route('properties.units.tenancy.rent-payments.store', [property, unit, tenancy.id]), {
            preserveScroll: true,
            onSuccess: () => {
                rentPaymentForm.reset('reference', 'notes');
                rentPaymentForm.setData('amount', '');
            },
        });
    };

    const activeCharges = (tenancy.rent_charges || []).filter(charge => !charge.voided_at);
    const totalCharges = activeCharges.reduce((sum, charge) => sum + Number(charge.amount), 0);
    const totalPaid = activeCharges.reduce(
        (sum, charge) => sum + (charge.payments || []).reduce((chargeSum, payment) => chargeSum + Number(payment.amount), 0),
        0,
    );
    const dueBalance = (tenancy.rent_charges || [])
        .filter(charge => !charge.voided_at && String(charge.due_date).slice(0, 10) <= todayDate)
        .reduce((sum, charge) => {
            const chargePaid = (charge.payments || []).reduce((paid, payment) => paid + Number(payment.amount), 0);
            return sum + Math.max(0, Number(charge.amount) - chargePaid);
        }, 0);
    const scheduledRenewal = tenancy.renewals?.find(renewal => renewal.status === 'scheduled');
    const rentPayments = activeCharges.flatMap(charge => (charge.payments || [])
        .filter(payment => charge.charge_type === 'rent')
        .map(payment => ({
            ...payment,
            charge: {
                ...charge,
                period_label: charge.period_start && charge.period_end
                    ? `${formatDate(charge.period_start, locale)} – ${formatDate(charge.period_end, locale)}`
                    : null,
            },
        })));
    const combinedPaymentGroups = Object.values(rentPayments.reduce((groups, payment) => {
        const key = payment.transaction_id || `legacy-${payment.id}`;
        groups[key] = [...(groups[key] || []), payment];
        return groups;
    }, {}));

    return (
        <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-100 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('Tenancy & lease')}</h3>
                            <p className="mt-1 text-lg font-semibold text-gray-900">{tenancy.tenant?.name}</p>
                            <p className="mt-1 text-sm text-gray-600">{formatDate(tenancy.start_date, locale)} {t('to')} {tenancy.end_date ? formatDate(tenancy.end_date, locale) : t('Ongoing')} · {t(tenancy.rent_frequency)} {t('rent')}</p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">{t(tenancy.status)}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{t('Rent per period')}</p><p className="mt-1 font-semibold text-gray-900">{Number(tenancy.monthly_rent).toLocaleString()} RWF</p></div>
                        <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{t('Ledger charges')}</p><p className="mt-1 font-semibold text-gray-900">{totalCharges.toLocaleString()} RWF</p></div>
                        <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{t('Collected')}</p><p className="mt-1 font-semibold text-gray-900">{totalPaid.toLocaleString()} RWF</p></div>
                        <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">{t('Due / overdue balance')}</p><p className={`mt-1 font-semibold ${dueBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>{dueBalance.toLocaleString()} RWF</p></div>
                    </div>
                    {tenancy.status === 'active' && outstandingRentCents > 0 && (
                        <form onSubmit={submitRentPayment} className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                            <div className="mb-3">
                                <h4 className="font-semibold text-gray-900">{t('Record rent payment')}</h4>
                                <p className="mt-1 text-xs text-gray-600">
                                    {t('Outstanding rent across :count periods. One payment can cover several periods; it is applied to the oldest balance first and creates one receipt.', { count: outstandingRentCharges.length })}
                                </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="text-xs font-medium text-gray-600">{t('Payment amount')}
                                    <input type="number" min="0.01" max={(outstandingRentCents / 100).toFixed(2)} step="0.01" required value={rentPaymentForm.data.amount} onChange={event => rentPaymentForm.setData('amount', event.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                                    {rentPaymentForm.errors.amount && <span className="mt-1 block text-red-600">{rentPaymentForm.errors.amount}</span>}
                                </label>
                                <label className="text-xs font-medium text-gray-600">{t('Method')}
                                    <select value={rentPaymentForm.data.method} onChange={event => rentPaymentForm.setData('method', event.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm">
                                        <option value="cash">{t('Cash')}</option>
                                        <option value="bank_transfer">{t('Bank transfer')}</option>
                                        <option value="mobile_money">{t('Mobile money')}</option>
                                        <option value="other">{t('Other')}</option>
                                    </select>
                                </label>
                                <label className="text-xs font-medium text-gray-600">{t('Paid at')}
                                    <input type="datetime-local" required value={rentPaymentForm.data.paid_at} onChange={event => rentPaymentForm.setData('paid_at', event.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                                </label>
                                <label className="text-xs font-medium text-gray-600">{t(['bank_transfer', 'mobile_money'].includes(rentPaymentForm.data.method) ? 'Bank / Mobile Money transaction ID' : 'Reference (optional)')}
                                    <input required={['bank_transfer', 'mobile_money'].includes(rentPaymentForm.data.method)} value={rentPaymentForm.data.reference} onChange={event => rentPaymentForm.setData('reference', event.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" />
                                    {rentPaymentForm.errors.reference && <span className="mt-1 block text-red-600">{rentPaymentForm.errors.reference}</span>}
                                </label>
                            </div>
                            <button disabled={rentPaymentForm.processing} className="mt-3 w-full rounded-lg bg-[#0E3B2E] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                                {rentPaymentForm.processing ? t('Saving payment…') : t('Record one payment')}
                            </button>
                        </form>
                    )}
                    {combinedPaymentGroups.filter(group => group.length > 1).map(group => (
                        <div key={group[0].id} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                            <p className="text-sm text-emerald-900">{t('One payment covers :count rent periods', { count: group.length })}</p>
                            <PaymentReceiptButton
                                payment={group[0]}
                                payments={group}
                                charge={group[0].charge}
                                tenant={tenancy.tenant}
                                property={property}
                                unit={unit}
                                agreement={{ reference: tenancy.leases?.[0]?.reference_number }}
                            />
                        </div>
                    ))}
                </div>

                <div className="border-b border-gray-100 p-6">
                    <h4 className="flex items-center gap-2 font-semibold text-gray-900"><Receipt size={16} className="text-[#0E3B2E]" /> {t('Rent and deposit ledger')}</h4>
                    <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
                        {tenancy.rent_charges?.length ? [...tenancy.rent_charges].sort((a, b) => a.due_date.localeCompare(b.due_date)).map(charge => (
                            <ChargeRow key={charge.id} charge={charge} property={property} unit={unit} tenancy={tenancy} />
                        )) : <p className="p-5 text-sm text-gray-500">{t('No rent charges yet. Scheduled charge generation will fill missing periods automatically.')}</p>}
                    </div>
                </div>

                <form onSubmit={submitLease} className="space-y-3 border-b border-gray-100 p-6">
                    <label className="block text-sm font-medium text-gray-700">{t('Upload another signed lease or amendment')}</label>
                    <LeaseRecordFields
                        paymentMethod={leaseForm.data.payment_method}
                        onPaymentMethodChange={value => leaseForm.setData('payment_method', value)}
                        paymentReference={leaseForm.data.payment_reference}
                        onPaymentReferenceChange={value => leaseForm.setData('payment_reference', value)}
                        errors={leaseForm.errors}
                    />
                    <LeaseNoteField
                        value={leaseForm.data.notes}
                        onChange={value => leaseForm.setData('notes', value)}
                        routeName="properties.units.tenancy.lease-notes.generate-for-tenancy"
                        routeParams={[property.id, unit.id, tenancy.id]}
                        payload={{ purpose: 'attachment' }}
                    />
                    <label className="block text-sm font-medium text-gray-700">
                        {t('Signed lease document (required)')}
                        <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => leaseForm.setData('lease', e.target.files[0])} className="mt-1 block w-full text-sm text-gray-600" required />
                        <span className="mt-1 block text-xs font-normal text-gray-500">{t('PDF, DOC, DOCX, JPG, JPEG or PNG. Maximum 10 MB.')}</span>
                        {leaseForm.errors.lease && <span className="mt-1 block text-xs text-red-600">{leaseForm.errors.lease}</span>}
                    </label>
                    <button disabled={leaseForm.processing} className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                        <Upload size={15} /> {leaseForm.processing ? t('Uploading…') : t('Upload lease')}
                    </button>
                </form>
                <div className="divide-y divide-gray-100">
                    {tenancy.leases?.length ? tenancy.leases.map(lease => (
                        <div key={lease.id} className="flex items-center justify-between gap-3 p-4">
                            <div className="flex min-w-0 items-center gap-3"><FileText size={18} className="shrink-0 text-gray-400" /><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-900">{lease.original_name}</p><p className="mt-1 break-words text-xs text-gray-500">{t('Reference')}: {lease.reference_number || '—'} · {t('Payment method')}: {t(({ cash: 'Cash', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', other: 'Other' })[lease.payment_method] || 'Unknown')}</p>{lease.payment_reference && <p className="mt-1 break-words text-xs text-gray-500">{t('Payment reference')}: {lease.payment_reference}</p>}{lease.notes && <p className="mt-1 whitespace-pre-line break-words text-xs text-gray-500">{lease.notes}</p>}<p className="text-xs text-gray-500">{(lease.size / 1024 / 1024).toFixed(2)} MB</p></div></div>
                            <div className="flex shrink-0 items-center gap-2"><a href={route('properties.units.tenancy.leases.download', [property, unit, tenancy.id, lease.id])} className="rounded-lg p-2 text-[#0E3B2E] hover:bg-gray-100" aria-label={`Download ${lease.original_name}`}><Download size={16} /></a><Link as="button" method="delete" href={route('properties.units.tenancy.leases.destroy', [property, unit, tenancy.id, lease.id])} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${lease.original_name}`}><Trash2 size={16} /></Link></div>
                        </div>
                    )) : <p className="p-6 text-sm text-gray-500">{t('No leases uploaded yet.')}</p>}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="border-b border-gray-100 p-5">
                        <h4 className="flex items-center gap-2 font-semibold text-gray-900"><CalendarClock size={16} className="text-[#0E3B2E]" /> {t('Renew lease')}</h4>
                        <p className="mt-1 text-xs text-gray-500">{t('The next term is linked to this tenancy. Its deposit carries forward without being charged again.')}</p>
                    </div>
                    {scheduledRenewal ? <p className="p-5 text-sm text-purple-800">{t('A renewal is scheduled to start on :date; it will activate automatically on that date.', { date: formatDate(scheduledRenewal.start_date, locale) })}</p> : (
                        <form onSubmit={submitRenewal} className="grid gap-3 p-5 sm:grid-cols-2">
                            <label className="text-xs font-medium text-gray-600">{t('New lease start')}<input type="date" required min={renewalStart} value={renewalForm.data.start_date} onChange={e => renewalForm.setData('start_date', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" /></label>
                            <label className="text-xs font-medium text-gray-600">{t('New lease end')}<input type="date" required value={renewalForm.data.end_date} onChange={e => renewalForm.setData('end_date', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" /></label>
                            <label className="text-xs font-medium text-gray-600">{t('Rent frequency')}<select value={renewalForm.data.rent_frequency} onChange={e => renewalForm.setData('rent_frequency', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm"><option value="daily">{t('Daily')}</option><option value="weekly">{t('Weekly')}</option><option value="monthly">{t('Monthly')}</option><option value="quarterly">{t('Quarterly')}</option><option value="yearly">{t('Yearly')}</option></select></label>
                            {renewalForm.data.rent_frequency === 'monthly' && <label className="text-xs font-medium text-gray-600">{t('Due day')}<input type="number" min="1" max="31" required value={renewalForm.data.due_day} onChange={e => renewalForm.setData('due_day', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" /></label>}
                            <label className="text-xs font-medium text-gray-600">{t('Rent per period (RWF)')}<input type="number" min="0.01" step="0.01" required value={renewalForm.data.monthly_rent} onChange={e => renewalForm.setData('monthly_rent', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" /></label>
                            <LeaseRecordFields
                                paymentMethod={renewalForm.data.payment_method}
                                onPaymentMethodChange={value => renewalForm.setData('payment_method', value)}
                                paymentReference={renewalForm.data.payment_reference}
                                onPaymentReferenceChange={value => renewalForm.setData('payment_reference', value)}
                                errors={renewalForm.errors}
                            />
                            <LeaseNoteField
                                value={renewalForm.data.lease_notes}
                                onChange={value => renewalForm.setData('lease_notes', value)}
                                routeName="properties.units.tenancy.lease-notes.generate-for-tenancy"
                                routeParams={[property.id, unit.id, tenancy.id]}
                                payload={{
                                    purpose: 'renewal',
                                    start_date: renewalForm.data.start_date,
                                    end_date: renewalForm.data.end_date,
                                    monthly_rent: renewalForm.data.monthly_rent,
                                    rent_frequency: renewalForm.data.rent_frequency,
                                }}
                                disabled={!renewalForm.data.start_date || !renewalForm.data.end_date || !renewalForm.data.monthly_rent}
                            />
                            <label className="text-xs font-medium text-gray-600 sm:col-span-2">{t('Signed renewal lease')}<input type="file" required accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => renewalForm.setData('lease', e.target.files[0])} className="mt-1 w-full text-sm" />{renewalForm.errors.lease && <span className="mt-1 block text-xs text-red-600">{renewalForm.errors.lease}</span>}</label>
                            {renewalForm.errors.start_date && <p className="text-xs text-red-600 sm:col-span-2">{renewalForm.errors.start_date}</p>}
                            <button disabled={renewalForm.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2">{renewalForm.processing ? t('Saving…') : t('Save renewal')}</button>
                        </form>
                    )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="border-b border-gray-100 p-5">
                        <h4 className="flex items-center gap-2 font-semibold text-gray-900"><ClipboardCheck size={16} className="text-amber-600" /> {t('Move-out inspection')}</h4>
                        <p className="mt-1 text-xs text-gray-500">{t('Record the unit condition and reconcile all received deposits before closing the tenancy.')}</p>
                    </div>
                    <form onSubmit={submitMoveOut} className="grid gap-3 p-5 sm:grid-cols-2">
                        <label className="text-xs font-medium text-gray-600">{t('Move-out date')}<input type="date" max={todayDate} required value={moveOutForm.data.move_out_date} onChange={e => moveOutForm.setData('move_out_date', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" /></label>
                        <label className="text-xs font-medium text-gray-600">{t('Deposit received')}<input readOnly value={`${depositReceived.toLocaleString()} RWF`} className="mt-1 w-full rounded-lg border-gray-200 bg-gray-50 text-sm" /></label>
                        <label className="text-xs font-medium text-gray-600 sm:col-span-2">{t('Damage cost (RWF)')}<input type="number" min="0" step="0.01" required value={moveOutForm.data.damage_cost} onChange={e => moveOutForm.setData('damage_cost', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" /></label>
                        <div className="rounded-xl bg-emerald-50 p-3 text-sm sm:col-span-2">
                            <p className="font-semibold text-emerald-900">{t('Deposit refund')}: {depositRefund.toLocaleString()} RWF</p>
                            {damageDue > 0 && <p className="mt-1 font-semibold text-amber-800">{t('Additional damage amount due')}: {damageDue.toLocaleString()} RWF</p>}
                            {damageCost > 0 && damageCost <= depositReceived && <p className="mt-1 text-xs text-emerald-800">{t('Damage costs will be deducted from the deposit.')}</p>}
                        </div>
                        <label className="text-xs font-medium text-gray-600 sm:col-span-2">{t('Deduction explanation')}<textarea value={moveOutForm.data.deduction_notes} onChange={e => moveOutForm.setData('deduction_notes', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" /></label>
                        <label className="text-xs font-medium text-gray-600 sm:col-span-2">{t('Condition / inspection notes')}<textarea required value={moveOutForm.data.condition_notes} onChange={e => moveOutForm.setData('condition_notes', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm" /></label>
                        <label className="text-xs font-medium text-gray-600 sm:col-span-2">{t('Unit after move-out')}<select value={moveOutForm.data.unit_outcome} onChange={e => moveOutForm.setData('unit_outcome', e.target.value)} className="mt-1 w-full rounded-lg border-gray-200 text-sm"><option value="available">{t('Available for rent')}</option><option value="maintenance">{t('Needs maintenance')}</option></select></label>
                        {Object.values(moveOutForm.errors).length > 0 && <p className="text-xs text-red-600 sm:col-span-2">{Object.values(moveOutForm.errors)[0]}</p>}
                        <button disabled={moveOutForm.processing} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 sm:col-span-2">{moveOutForm.processing ? 'Saving inspection…' : 'Complete move-out and settle deposit'}</button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function UnitShow({ property, unit }) {
    const { t, language } = useTranslation();
    const tenancy = unit.active_tenancy;
    const locale = { en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' }[language];

    return (
        <AuthenticatedLayout header={t(':unit - Details', { unit: unit.unit_number })}>
            <Head title={t('Unit :unit', { unit: unit.unit_number })} />

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Link
                    href={route('properties.units.index', property)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-[#0E3B2E]"
                >
                    <ArrowLeft size={16} />
                    {t('Back to Units')}
                </Link>

                <Link
                    href={route('properties.units.edit', [property, unit])}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23]"
                >
                    <Edit size={15} />
                    {t('Edit Unit')}
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0E3B2E]/10">
                                        <Home size={24} className="text-[#0E3B2E]" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900">
                                            {unit.unit_number}
                                        </h2>
                                        <p className="text-sm text-gray-500">
                                            {unit.unit_type?.name || t('Unit')}
                                        </p>
                                    </div>
                                </div>
                                <span className={`self-start rounded-full px-3 py-1 text-xs font-medium capitalize ${statusStyles[unit.status]}`}>
                                    {t(unit.status)}
                                </span>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 p-6">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                                {t('Unit Details')}
                            </h3>
                            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{t('Property')}</dt>
                                    <dd className="mt-1 text-sm font-medium text-gray-900">{property.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{t('Unit Type')}</dt>
                                    <dd className="mt-1 text-sm font-medium text-gray-900">{unit.unit_type?.name || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{t('Monthly Rent')}</dt>
                                    <dd className="mt-1 flex items-center gap-1">
                                        <DollarSign size={14} className="text-gray-400" />
                                        <span className="text-sm font-semibold text-gray-900">
                                            {Number(unit.rent_amount).toLocaleString()} RWF
                                        </span>
                                        {unit.size_sqm != null && unit.size_sqm !== '' && (
                                            <span className="text-sm font-medium text-gray-500">
                                                {' '}· {Number(unit.size_sqm).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²
                                            </span>
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{t('Size (m²)')}</dt>
                                    <dd className="mt-1 text-sm font-medium text-gray-900">
                                        {unit.size_sqm != null && unit.size_sqm !== ''
                                            ? `${Number(unit.size_sqm).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`
                                            : '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">{t('Status')}</dt>
                                    <dd className="mt-1">
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[unit.status]}`}>
                                            {t(unit.status)}
                                        </span>
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {unit.description && (
                            <div className="border-t border-gray-100 p-6">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    {t('Description')}
                                </h3>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {unit.description}
                                </p>
                            </div>
                        )}
                    </div>
                    {tenancy && <TenancyManager tenancy={tenancy} property={property} unit={unit} />}
                    {!tenancy && unit.scheduled_tenancy && (
                        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
                            <h3 className="font-semibold text-purple-900">{t('Upcoming move-in scheduled')}</h3>
                            <p className="mt-1 text-sm text-purple-800">{unit.scheduled_tenancy.tenant?.name} · {t('Starts')} {formatDate(unit.scheduled_tenancy.start_date, locale)}</p>
                            <p className="mt-2 text-xs text-purple-700">{t('The unit is reserved and will become occupied automatically on the start date.')}</p>
                            {unit.scheduled_tenancy.rent_charges?.length > 0 && (
                                <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-purple-200 bg-white">
                                    {unit.scheduled_tenancy.rent_charges.map(charge => <ChargeRow key={charge.id} charge={charge} property={property} unit={unit} tenancy={unit.scheduled_tenancy} />)}
                                </div>
                            )}
                        </div>
                    )}
                    {unit.tenancies?.some(record => record.status === 'ended' || record.status === 'cancelled') && (
                        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                            <div className="border-b border-gray-100 p-5">
                                <h3 className="font-semibold text-gray-900">{t('Tenancy history')}</h3>
                                <p className="mt-1 text-xs text-gray-500">{t('Previous agreements remain available for audit and financial history.')}</p>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {unit.tenancies.filter(record => record.status === 'ended' || record.status === 'cancelled').map(record => (
                                    <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{record.tenant?.name}</p>
                                            <p className="text-xs text-gray-500">{formatDate(record.start_date, locale)} – {formatDate(record.actual_end_date || record.end_date, locale)}</p>
                                            {record.move_out_inspection && <p className="mt-1 text-xs text-gray-500">{t('Deposit')}: {Number(record.move_out_inspection.deposit_received).toLocaleString()} {t('received')} · {Number(record.move_out_inspection.deposit_refunded).toLocaleString()} {t('refunded')} · {Number(record.move_out_inspection.deposit_deducted).toLocaleString()} {t('deducted')}</p>}
                                            {record.rent_charges?.length > 0 && <p className="mt-1 text-xs text-gray-500">{t('Rent/deposit payments recorded')}: {record.rent_charges.reduce((total, charge) => total + (charge.payments || []).reduce((paid, payment) => paid + Number(payment.amount), 0), 0).toLocaleString()} RWF</p>}
                                            <p className="mt-1 text-xs font-semibold text-[#0E3B2E]">{record.leases?.[0]?.reference_number || t('Agreement reference not available')}</p>
                                            {record.rent_charges?.some(charge => charge.payments?.length) && (
                                                <details className="mt-2">
                                                    <summary className="cursor-pointer text-xs font-medium text-gray-600">{t('Payment history')}</summary>
                                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                        {record.rent_charges.flatMap(charge => (charge.payments || []).map(payment => ({ ...payment, charge_type: charge.charge_type }))).map(payment => <PaymentRecordDetails key={payment.id} payment={payment} />)}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">{t(record.status)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {unit.images?.length > 0 && (
                        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                            <div className="p-6">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('Unit Images')}</h3>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    {unit.images.map((image) => (
                                        <img
                                            key={image.id}
                                            src={/^https?:\/\//i.test(image.image_path) ? image.image_path : `/unit-images/${image.image_path}`}
                                            alt={t('Unit :unit', { unit: unit.unit_number })}
                                            className="h-36 w-full rounded-xl object-cover"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <MapPin size={16} className="text-gray-400" />
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                                    {t('Property Location')}
                                </h3>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{property.name}</p>
                            <p className="mt-1 text-sm text-gray-500">{property.address}</p>
                            {property.cell?.sector?.district?.province && (
                                <div className="mt-3 space-y-1 text-xs text-gray-500">
                                    <p>{property.cell.sector.district.province.name} {t('Province')}</p>
                                    <p>{property.cell.sector.district.name} {t('District')}</p>
                                    <p>{property.cell.sector.name} {t('Sector')}</p>
                                    <p>{property.cell.name} {t('Cell')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-[#0E3B2E] to-[#0a2e23] shadow-sm p-6">
                        <h3 className="text-sm font-semibold text-[#D9A441] uppercase tracking-wide mb-2">
                            {t('Quick Actions')}
                        </h3>
                        <div className="space-y-2">
                            <Link
                                href={route('properties.units.edit', [property, unit])}
                                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20"
                            >
                                <Edit size={15} />
                                {t('Edit this Unit')}
                            </Link>
                            <Link
                                href={route('properties.units.index', property)}
                                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20"
                            >
                                <ArrowLeft size={15} />
                                {t('View All Units')}
                            </Link>
                            <Link
                                href={route('properties.show', property)}
                                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20"
                            >
                                <Home size={15} />
                                {t('Go to Property')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
