import LeaseNoteField from '@/Components/LeaseNoteField';
import MobileMoneyRequestPanel from '@/Components/MobileMoneyRequestPanel';
import RwandaPhoneInput from '@/Components/RwandaPhoneInput';
import { RWANDA_MOBILE_REGEX } from '@/lib/rwanda';
import { Link } from '@inertiajs/react';
import useFloorLabel from '@/hooks/useFloorLabel';
import { useTranslation } from '@/localization';
import { countRentPeriods } from '@/utils/rentPeriodCalculator';
import { isApartmentUnit } from '@/utils/unitType';
import { useForm, usePage } from '@inertiajs/react';
import {
    AlertCircle, Building2, CalendarDays, CheckCircle2, Circle, CreditCard, FileText, HandCoins, Landmark,
    FileCheck, Loader2, Lock, Search, ShieldCheck, Smartphone, Upload, Wallet, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

// Keep in step with TenancyController::MINIMUM_MONTHS.
const MINIMUM_MONTHS = 2;
const LEASE_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
const LEASE_MAX_BYTES = 10 * 1024 * 1024;

/** "2026-10-25T09:30" in the browser's own time, for datetime-local inputs. */
const localDateTime = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const today = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Same date `months` later minus one day: a lease from 1 Jan for 2 months ends 28/29 Feb. */
const leaseEnd = (start, months) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')) return '';
    const [y, m, d] = start.split('-').map(Number);
    const targetMonth = m - 1 + months;
    const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
    const end = new Date(Date.UTC(y, targetMonth, Math.min(d, lastDay)));
    end.setUTCDate(end.getUTCDate() - 1);
    return end.toISOString().slice(0, 10);
};

// Ideas for what a client uses a unit for; anything else can be typed.
export const BUSINESS_USES = ['Office', 'Shop', 'Salon', 'Restaurant', 'Coffee shop', 'Warehouse', 'Storage', 'Clinic', 'Pharmacy', 'Supermarket', 'Bank', 'School', 'Workshop', 'Showroom', 'Apartment', 'Gym'];

const fieldClass = (invalid) => `mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-all focus:outline-none focus:ring-2 ${invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;

// Every method needs its proof: the bank slip reference, the MoMo transaction ID or the cheque number.
const PAYMENT_METHODS = [
    { value: 'bank_transfer', label: 'Bank transfer', icon: Landmark, reference: 'Bank slip reference', missing: 'Enter the bank slip reference.', hint: 'As printed on the bank deposit slip.' },
    { value: 'mobile_money', label: 'Mobile money', icon: Smartphone, reference: 'Mobile money transaction ID', missing: 'Enter the mobile money transaction ID.', hint: 'The ID in the MTN MoMo or Airtel Money confirmation SMS.' },
    { value: 'cheque', label: 'Cheque', icon: FileCheck, reference: 'Cheque number', missing: 'Enter the cheque number.', hint: 'The number printed on the cheque.' },
];

/**
 * Assign a tenant to a unit: choose the unit, lease dates and rent, record the
 * money received and upload the signed lease. Monthly rentals: at least two
 * months; the tenant pays months 1–2 plus a one-month security deposit.
 */
export default function AssignUnitForm({ tenant, availableUnits }) {
    const { t, language } = useTranslation();
    const floorLabel = useFloorLabel();
    const locale = ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 2 })} RWF`;

    const form = useForm({
        tenant_id: tenant.id,
        unit_id: '',
        business_use: '',
        start_date: today(),
        end_date: '',
        monthly_rent: '',
        rent_frequency: 'monthly',
        check_in_time: '14:00',
        check_out_time: '11:00',
        deposit_amount: '0',
        lease: null,
        lease_notes: '',
        payment_method: '',
        payment_reference: '',
        mobile_money_request_id: '',
        // MoMo Pay to the owner's code: details from the tenant's MoMo SMS.
        payer_name: '',
        payer_phone: '',
        paid_at: localDateTime(new Date()),
        payment_proof: null,
    });
    const { data, setData, errors, processing } = form;
    const [submitted, setSubmitted] = useState(false);
    // Choose the floor first (building and floor), then the unit on it.
    const [floorKey, setFloorKey] = useState('');
    const [leaseNotice, setLeaseNotice] = useState('');
    // Mobile money: send a request to the tenant's phone, or type the ID of a payment already made.
    const [momoMode, setMomoMode] = useState('momopay');
    const leaseInput = useRef(null);

    const selectedUnit = availableUnits.find(unit => String(unit.id) === String(data.unit_id));
    const paymentMethod = PAYMENT_METHODS.find(method => method.value === data.payment_method);

    // After a successful assignment the unit leaves the available list: start a clean form.
    useEffect(() => {
        if (data.unit_id && !selectedUnit && !processing) {
            form.reset();
            form.clearErrors();
            setSubmitted(false);
        }
    }, [availableUnits]);
    const apartmentStay = isApartmentUnit(selectedUnit);
    const dailyStay = apartmentStay && data.rent_frequency === 'daily';
    const monthly = !dailyStay;
    const rent = Number(data.monthly_rent) || 0;
    const periods = countRentPeriods(data.start_date, data.end_date, data.rent_frequency);
    const totalRent = periods > 0 && rent > 0 ? periods * rent : 0;
    const minimumEnd = monthly ? leaseEnd(data.start_date, MINIMUM_MONTHS) : data.start_date;
    const depositNow = monthly ? rent : Number(data.deposit_amount) || 0;
    const rentNow = monthly ? rent * MINIMUM_MONTHS : 0;
    const dueNow = rentNow + depositNow;

    const chooseUnit = (unit) => {
        const daily = isApartmentUnit(unit) && unit.rent_frequency === 'daily';
        setData(current => ({
            ...current,
            unit_id: String(unit.id),
            monthly_rent: unit.rent_amount ?? '',
            rent_frequency: daily ? 'daily' : 'monthly',
            deposit_amount: daily ? current.deposit_amount : String(unit.rent_amount ?? 0),
            end_date: current.end_date || (daily ? '' : leaseEnd(current.start_date, 12)),
            check_in_time: '14:00',
            check_out_time: '11:00',
        }));
    };
    const setFrequency = (value) => setData(current => ({ ...current, rent_frequency: value, deposit_amount: value === 'monthly' ? String(current.monthly_rent || 0) : '0' }));

    // Phone requests are for monthly rentals (rent for 2 months + 1-month deposit).
    const phoneRequest = data.payment_method === 'mobile_money' && monthly && momoMode === 'request';
    const momoPay = data.payment_method === 'mobile_money' && !phoneRequest;
    const owner = selectedUnit?.property?.owner;
    const ownerCode = owner?.momo_pay_code;
    const isOwner = usePage().props.auth?.user?.id === owner?.id;

    // Checks in the browser, mirroring the server.
    const clientErrors = {};
    if (!selectedUnit) clientErrors.unit_id = floorKey ? t('Choose the unit to assign.') : t('Choose the floor, then the unit.');
    if (!data.business_use.trim()) clientErrors.business_use = t('Type what the client will use the unit for, for example Office or Salon.');
    if (!data.start_date) clientErrors.start_date = t('Choose the start date.');
    if (!data.end_date) clientErrors.end_date = t('Choose the end date.');
    else if (data.end_date <= data.start_date) clientErrors.end_date = t('The end date must be after the start date.');
    else if (monthly && data.end_date < minimumEnd) clientErrors.end_date = t('A monthly lease lasts at least :months months. Choose :date or later.', { months: MINIMUM_MONTHS, date: minimumEnd });
    if (!(rent > 0)) clientErrors.monthly_rent = t('Enter the rent in RWF.');
    if (!data.payment_method) clientErrors.payment_method = t('Choose how the money was paid.');
    else if (phoneRequest) {
        if (!data.mobile_money_request_id) clientErrors.mobile_money_request_id = t('Send the payment request and wait for the tenant to approve it.');
    } else if (momoPay) {
        if (!data.payer_name.trim()) clientErrors.payer_name = t('Enter the name of the person who paid.');
        if (!RWANDA_MOBILE_REGEX.test(data.payer_phone)) clientErrors.payer_phone = t('Enter the 9 digits after +250, starting with 72, 73, 78 or 79.');
        if (!data.paid_at) clientErrors.paid_at = t('Enter the date and time of the payment.');
        if (!/^[0-9]{6,20}$/.test(data.payment_reference.replace(/\s+/g, ''))) clientErrors.payment_reference = t('Enter the transaction ID from the MoMo SMS: numbers only.');
    } else if (!data.payment_reference.trim()) clientErrors.payment_reference = t(paymentMethod?.missing || 'Enter the transaction reference.');
    if (!data.lease) clientErrors.lease = t('Upload the signed lease.');

    const shownError = (field) => errors[field] || (submitted ? clientErrors[field] : undefined);
    const sections = [
        { id: 'unit', title: t('Unit'), fields: ['unit_id', 'business_use'] },
        { id: 'dates', title: t('Lease dates'), fields: ['start_date', 'end_date', 'check_in_time', 'check_out_time'] },
        { id: 'rent', title: t('Rent'), fields: ['monthly_rent', 'rent_frequency'] },
        { id: 'payment', title: t('Payment at assignment'), fields: ['payment_method', 'payment_reference', 'mobile_money_request_id', 'deposit_amount', 'payer_name', 'payer_phone', 'paid_at', 'payment_proof'] },
        { id: 'lease', title: t('Signed lease'), fields: ['lease', 'lease_notes'] },
    ].map(section => ({ ...section, done: section.fields.every(field => !clientErrors[field] && !errors[field]) }));
    const doneCount = sections.filter(s => s.done).length;
    const done = Object.fromEntries(sections.map(s => [s.id, s.done]));

    const submit = (event) => {
        event.preventDefault();
        setSubmitted(true);
        const firstOpen = sections.find(s => !s.done);
        if (firstOpen) {
            document.getElementById(`assign-${firstOpen.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        form.transform(({ check_in_time, check_out_time, mobile_money_request_id, payer_name, payer_phone, paid_at, payment_proof, ...values }) => ({
            ...values,
            ...(momoPay ? { payer_name, payer_phone: `0${payer_phone}`, paid_at, payment_proof } : {}),
            // A confirmed phone payment is its own proof; the server reads its transaction ID.
            ...(phoneRequest ? { mobile_money_request_id, payment_reference: '' } : {}),
            deposit_amount: monthly ? values.monthly_rent : values.deposit_amount,
            // Check-in and check-out times belong to nightly stays only.
            ...(dailyStay ? { check_in_time, check_out_time } : {}),
        }));
        form.post(route('properties.units.tenancy.store', [selectedUnit.property_id, selectedUnit.id]), {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                form.reset();
                setSubmitted(false);
                setMomoMode('momopay');
                setFloorKey('');
            },
        });
    };

    const pickLease = (file) => {
        if (!file) return;
        const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (!LEASE_TYPES.split(',').includes(extension)) {
            setLeaseNotice(t('Upload a PDF, Word document or photo (JPG, PNG).'));
            return;
        }
        if (file.size > LEASE_MAX_BYTES) {
            setLeaseNotice(t('The lease file must be 10 MB or smaller.'));
            return;
        }
        setLeaseNotice('');
        setData('lease', file);
    };

    const keyOf = (unit) => `${unit.property_id}:${unit.floor_number ?? 0}`;
    const floorOptions = useMemo(() => {
        const seen = new Map();
        availableUnits.forEach(unit => {
            const key = keyOf(unit);
            if (!seen.has(key)) seen.set(key, { key, property: unit.property?.name, floor: unit.floor_number ?? 0, count: 0 });
            seen.get(key).count += 1;
        });
        return [...seen.values()].sort((a, b) => String(a.property).localeCompare(String(b.property)) || a.floor - b.floor);
    }, [availableUnits]);
    const multipleBuildings = new Set(availableUnits.map(unit => unit.property_id)).size > 1;
    const units = useMemo(() => availableUnits
        .filter(unit => floorKey && keyOf(unit) === floorKey)
        .sort((a, b) => String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true })), [availableUnits, floorKey]);
    // A single floor is chosen straight away.
    useEffect(() => {
        if (!floorKey && floorOptions.length === 1) setFloorKey(floorOptions[0].key);
    }, [floorOptions]);

    const errorLine = (field) => shownError(field) && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} aria-hidden="true" />{shownError(field)}</p>
    );

    return (
        <form onSubmit={submit} noValidate className="space-y-5 p-5 sm:p-6">
            {/* Progress */}
            <div aria-live="polite" className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                    <span>{t(':done of :total sections complete', { done: doneCount, total: sections.length })}</span>
                    {doneCount === sections.length && <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={13} aria-hidden="true" />{t('Ready to save')}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={sections.length} aria-valuenow={doneCount} aria-label={t('Form progress')}>
                    <div className="h-full rounded-full bg-gradient-to-r from-[#0E3B2E] to-green-500 transition-all duration-500" style={{ width: `${(doneCount / sections.length) * 100}%` }} />
                </div>
                <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {sections.map((section, index) => (
                        <li key={section.id}>
                            <a href={`#assign-${section.id}`} className={`inline-flex items-center gap-1.5 text-xs font-medium ${section.done ? 'text-green-800' : 'text-gray-600 hover:text-gray-900'}`}>
                                {section.done ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" className="text-gray-300" />}
                                {index + 1}. {section.title}
                            </a>
                        </li>
                    ))}
                </ol>
            </div>

            {/* 1. Unit */}
            <Step id="unit" number={1} title={t('Choose the floor and the unit')} done={done.unit} icon={Building2}>
                {/* First the floor, then a second list with only the units on that floor. */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-800">
                        {t('1. Floor')}
                        <select value={floorKey} onChange={e => { setFloorKey(e.target.value); setData('unit_id', ''); }}
                            className={fieldClass(submitted && !floorKey)} aria-invalid={submitted && !floorKey ? 'true' : undefined}>
                            <option value="">{t('Choose the floor')}</option>
                            {floorOptions.map(option => (
                                <option key={option.key} value={option.key}>
                                    {multipleBuildings ? `${option.property} · ` : ''}{floorLabel(option.floor)} ({option.count === 1 ? t('1 unit') : t(':count units', { count: option.count })})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block text-sm font-medium text-gray-800">
                        {t('2. Unit')}
                        <select value={data.unit_id} disabled={!floorKey}
                            onChange={e => { const unit = units.find(item => String(item.id) === e.target.value); if (unit) chooseUnit(unit); else setData('unit_id', ''); }}
                            className={`${fieldClass(shownError('unit_id'))} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400`}
                            aria-invalid={shownError('unit_id') ? 'true' : undefined}>
                            <option value="">{floorKey ? t('Choose the unit') : t('Choose the floor first')}</option>
                            {units.map(unit => (
                                <option key={unit.id} value={unit.id}>
                                    {t('Unit :number', { number: unit.unit_number })}{unit.size_sqm ? ` · ${Number(unit.size_sqm).toLocaleString()} m²` : ''} · {money(unit.rent_amount)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                {floorOptions.length === 0 && <p className="mt-2 text-sm text-gray-600">{t('No unit is available right now.')}</p>}
                {selectedUnit && (
                    <div className="mt-3 flex animate-fade-in items-center gap-3 rounded-2xl border-2 border-[#0E3B2E] bg-[#0E3B2E]/[0.04] p-3.5">
                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#0E3B2E] text-white"><Building2 size={18} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-gray-900">{selectedUnit.property?.name} · {t('Unit :number', { number: selectedUnit.unit_number })}</span>
                            <span className="block truncate text-xs text-gray-600">
                                {floorLabel(selectedUnit.floor_number ?? 0)}{selectedUnit.size_sqm ? ` · ${Number(selectedUnit.size_sqm).toLocaleString()} m²` : ''}
                            </span>
                        </span>
                        <span className="text-right text-sm font-semibold text-[#0E3B2E]">
                            {money(selectedUnit.rent_amount)}<span className="block text-xs font-normal text-gray-500">/ {t(isApartmentUnit(selectedUnit) && selectedUnit.rent_frequency === 'daily' ? 'night' : 'month')}</span>
                        </span>
                        <CheckCircle2 size={18} className="flex-none text-[#0E3B2E]" aria-hidden="true" />
                    </div>
                )}
                {errorLine('unit_id')}

                <label className="mt-4 block text-sm font-medium text-gray-800">
                    {t('What will the client use it for?')} <span className="text-red-600" aria-hidden="true">*</span>
                    <input value={data.business_use} onChange={e => setData('business_use', e.target.value)} list="business-uses" maxLength={120}
                        placeholder={t('e.g. Office, Salon, Warehouse')} className={fieldClass(shownError('business_use'))}
                        aria-invalid={shownError('business_use') ? 'true' : undefined} />
                    <datalist id="business-uses">{BUSINESS_USES.map(use => <option key={use} value={t(use)} />)}</datalist>
                    <span className="mt-1 block text-xs font-normal text-gray-500">{t('The same unit can be an office for one client and a salon for the next.')}</span>
                    {errorLine('business_use')}
                </label>
            </Step>

            {/* 2. Dates */}
            <Step id="dates" number={2} title={t('Lease dates')} done={done.dates} icon={CalendarDays}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium text-gray-800">
                        {t(dailyStay ? 'Check-in date' : 'Lease start date')}
                        <input type="date" required min={today()} value={data.start_date}
                            onChange={e => setData(current => ({ ...current, start_date: e.target.value }))} className={fieldClass(shownError('start_date'))} />
                        {errorLine('start_date')}
                    </label>
                    <label className="text-sm font-medium text-gray-800">
                        {t(dailyStay ? 'Check-out date' : 'Lease end date')}
                        <input type="date" required min={monthly ? minimumEnd : data.start_date} value={data.end_date}
                            onChange={e => setData('end_date', e.target.value)} className={fieldClass(shownError('end_date'))} />
                        {errorLine('end_date')}
                    </label>
                </div>
                {!dailyStay && (errors.check_in_time || errors.check_out_time) && errorLine(errors.check_in_time ? 'check_in_time' : 'check_out_time')}
                {monthly && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">{t('Lease length:')}</span>
                        {[2, 6, 12].map(months => {
                            const end = leaseEnd(data.start_date, months);
                            const active = data.end_date === end;
                            return (
                                <button key={months} type="button" onClick={() => setData('end_date', end)}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${active ? 'border-[#0E3B2E] bg-[#0E3B2E] text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-[#0E3B2E]/50'}`}>
                                    {months === 12 ? t('1 year') : t(':count months', { count: months })}
                                </button>
                            );
                        })}
                        <span className="text-xs text-gray-500">{t('Minimum :count months.', { count: MINIMUM_MONTHS })}</span>
                    </div>
                )}
                {dailyStay && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-gray-800">{t('Check-in time')}
                            <input type="time" required value={data.check_in_time} onChange={e => setData('check_in_time', e.target.value)} className={fieldClass(shownError('check_in_time'))} />
                            <span className="mt-1 block text-xs font-normal text-gray-500">{t('Standard check-in time is 14:00.')}</span>
                        </label>
                        <label className="text-sm font-medium text-gray-800">{t('Check-out time')}
                            <input type="time" required value={data.check_out_time} onChange={e => setData('check_out_time', e.target.value)} className={fieldClass(shownError('check_out_time'))} />
                            <span className="mt-1 block text-xs font-normal text-gray-500">{t('Standard check-out time is 11:00.')}</span>
                        </label>
                    </div>
                )}
            </Step>

            {/* 3. Rent */}
            <Step id="rent" number={3} title={t('Rent')} done={done.rent} icon={Wallet}>
                <div className="grid gap-4 sm:grid-cols-2">
                    {apartmentStay ? (
                        <label className="text-sm font-medium text-gray-800">{t('Rent frequency')}
                            <select value={data.rent_frequency} onChange={e => setFrequency(e.target.value)} className={fieldClass(false)}>
                                <option value="monthly">{t('Monthly')}</option>
                                <option value="daily">{t('Daily')}</option>
                            </select>
                        </label>
                    ) : (
                        <div className="text-sm font-medium text-gray-800">{t('Rent frequency')}
                            <p className="mt-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-normal text-gray-700">{t('Monthly')}</p>
                        </div>
                    )}
                    <label className="text-sm font-medium text-gray-800">
                        {t(dailyStay ? 'Nightly rate (RWF)' : 'Monthly rent (RWF)')}
                        <span className="relative block">
                            <span className="pointer-events-none absolute left-4 top-1/2 mt-[3px] -translate-y-1/2 text-xs font-semibold text-gray-500" aria-hidden="true">RWF</span>
                            <input type="number" required readOnly aria-readonly="true" value={data.monthly_rent} aria-describedby="assign-rent-hint"
                                className={`${fieldClass(shownError('monthly_rent'))} cursor-not-allowed bg-gray-50 pl-14 pr-10 font-semibold text-gray-800`} />
                            <Lock size={15} className="pointer-events-none absolute right-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-gray-400" aria-hidden="true" />
                        </span>
                        <span id="assign-rent-hint" className="mt-1 block text-xs font-normal text-gray-500">{t('Set on the room. To change it, edit the room.')}</span>
                        {errorLine('monthly_rent')}
                    </label>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <Stat label={t(dailyStay ? 'Number of nights' : 'Number of months')} value={periods || '—'} />
                    <Stat label={t('Total rent for lease')} value={totalRent ? money(totalRent) : '—'} hint={t(dailyStay ? 'Rent is charged per night; check-out day is not billed.' : 'The security deposit is separate from rent.')} />
                </div>
            </Step>

            {/* 4. Payment */}
            <Step id="payment" number={4} title={t('Payment at assignment')} done={done.payment} icon={HandCoins}>
                {monthly ? (
                    <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                            {/* Rent paid in advance */}
                            <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0E3B2E]/10 text-[#0E3B2E]"><Wallet size={18} aria-hidden="true" /></span>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{t('Rent paid in advance')}</p>
                                        <p className="text-xs text-gray-600">{MINIMUM_MONTHS} × {money(rent)}</p>
                                    </div>
                                </div>
                                <p className="mt-3 font-[Sora] text-2xl font-bold text-gray-900">{money(rentNow)}</p>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {Array.from({ length: MINIMUM_MONTHS }, (_, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800 ring-1 ring-green-600/15">
                                            <CheckCircle2 size={12} aria-hidden="true" />{t('Month :number', { number: i + 1 })}
                                        </span>
                                    ))}
                                </div>
                                <p className="mt-2.5 text-xs text-gray-500">{t('From month 3, rent is paid month by month.')}</p>
                            </div>

                            {/* Refundable security deposit */}
                            <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
                                <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">{t('Refundable')}</span>
                                <div className="flex items-center gap-2.5 pr-20">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><ShieldCheck size={18} aria-hidden="true" /></span>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{t('Security deposit')}</p>
                                        <p className="flex items-center gap-1 text-xs text-gray-600">
                                            {t('Equal to 1 month of rent')} <Lock size={11} className="text-gray-400" aria-label={t('Fixed')} />
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-3 font-[Sora] text-2xl font-bold text-gray-900">{money(depositNow)}</p>
                                <p className="mt-3 text-xs leading-relaxed text-amber-900/80">
                                    {t('Kept as a guarantee and returned at move-out after the unit is checked. If there is damage, the repair cost is taken from it.')}
                                </p>
                            </div>
                        </div>

                        {/* Total */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#0E3B2E] to-[#1a5a45] px-5 py-4 text-white shadow-md shadow-[#0E3B2E]/20">
                            <div>
                                <p className="text-sm font-semibold">{t('Total to collect now')}</p>
                                <p className="mt-0.5 text-xs text-white/75">{t('Rent :rent + refundable deposit :deposit', { rent: money(rentNow), deposit: money(depositNow) })}</p>
                            </div>
                            <p className="font-[Sora] text-2xl font-bold tracking-tight">{money(dueNow)}</p>
                        </div>
                    </div>
                ) : (
                    <label className="block text-sm font-medium text-gray-800">{t('Security deposit (RWF)')}
                        <input type="number" min="0" step="0.01" value={data.deposit_amount} onChange={e => setData('deposit_amount', e.target.value)} className={fieldClass(shownError('deposit_amount'))} />
                        {errorLine('deposit_amount')}
                    </label>
                )}

                <fieldset className="mt-4">
                    <legend className="text-sm font-medium text-gray-800">{t('Payment method')}</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => {
                            const selected = data.payment_method === value;
                            return (
                                <label key={value}
                                    className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold transition-all focus-within:ring-2 focus-within:ring-[#0E3B2E]/30 ${selected ? 'border-[#0E3B2E] bg-[#0E3B2E]/[0.05] text-[#0E3B2E]' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}>
                                    <input type="radio" name="assign-payment-method" value={value} checked={selected} className="sr-only"
                                        onChange={() => setData(current => ({ ...current, payment_method: value, payment_reference: current.payment_method === value ? current.payment_reference : '', mobile_money_request_id: current.payment_method === value ? current.mobile_money_request_id : '' }))} />
                                    <Icon size={20} aria-hidden="true" />{t(label)}
                                </label>
                            );
                        })}
                    </div>
                    {errorLine('payment_method')}
                </fieldset>
                {phoneRequest && (
                    <div id="assign-mobile-money" className="mt-4 animate-fade-in">
                        <MobileMoneyRequestPanel
                            tenant={tenant}
                            unit={selectedUnit}
                            amountLabel={money(dueNow)}
                            onPaid={(paid) => setData(current => ({ ...current, mobile_money_request_id: String(paid.id), payment_reference: paid.transaction_id || '' }))}
                            onReset={() => setData(current => ({ ...current, mobile_money_request_id: '', payment_reference: '' }))}
                        />
                        {errorLine('mobile_money_request_id')}
                        {!data.mobile_money_request_id && (
                            <button type="button" onClick={() => setMomoMode('momopay')} className="mt-2 text-xs font-semibold text-[#0E3B2E] underline underline-offset-2">
                                {t('Already paid with MoMo Pay? Enter the SMS details instead')}
                            </button>
                        )}
                    </div>
                )}
                {momoPay && (
                    <div id="assign-momo-pay" className="mt-4 animate-fade-in space-y-4 rounded-2xl border border-gray-200 p-4">
                        <div className="rounded-xl bg-[#FFCC00]/15 p-4 ring-1 ring-[#FFCC00]/50">
                            <p className="text-sm font-bold text-gray-900">{t('The tenant pays the owner with MoMo Pay')}</p>
                            {ownerCode ? (
                                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-gray-800">
                                    <li>
                                        {t('The tenant dials')}{' '}
                                        <a href={`tel:${encodeURIComponent(`*182*8*1*${ownerCode}#`)}`} className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-gray-900 ring-1 ring-gray-200">{`*182*8*1*${ownerCode}#`}</a>
                                        <button type="button" onClick={() => navigator.clipboard?.writeText(ownerCode)} className="ml-1.5 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0E3B2E] ring-1 ring-gray-200 hover:bg-gray-50">{t('Copy')}</button>
                                    </li>
                                    <li>{t('Pay exactly :amount to :name.', { amount: money(dueNow), name: owner.momo_pay_name || owner.name })}</li>
                                    <li>{t('Fill in the details below from the MoMo SMS.')}</li>
                                </ol>
                            ) : (
                                <p className="mt-1 text-sm text-gray-800">
                                    {isOwner
                                        ? <>{t('Add your MoMo Pay code so tenants can pay you.')}{' '}<Link href={`${route('profile.edit')}#momo-pay`} className="font-semibold text-[#0E3B2E] underline underline-offset-2">{t('Add it in your profile')}</Link></>
                                        : t('The owner has not added a MoMo Pay code yet. Ask the owner for it, or record the payment details below.')}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-gray-800">{t('Name of the person who paid')}
                                <input value={data.payer_name} onChange={e => setData('payer_name', e.target.value)} maxLength={120} className={fieldClass(shownError('payer_name'))} />
                                {errorLine('payer_name')}
                            </label>
                            <div>
                                <label htmlFor="assign-payer-phone" className="block text-sm font-medium text-gray-800">{t('Phone number that paid')}</label>
                                <RwandaPhoneInput id="assign-payer-phone" value={data.payer_phone} onChange={(digits) => setData('payer_phone', digits)} error={shownError('payer_phone')} className="mt-1.5" />
                            </div>
                            <label className="block text-sm font-medium text-gray-800">{t('Amount paid')}
                                <input value={money(dueNow)} readOnly className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-900" />
                            </label>
                            <label className="block text-sm font-medium text-gray-800">{t('Date and time of the payment')}
                                <input type="datetime-local" value={data.paid_at} max={localDateTime(new Date())} onChange={e => setData('paid_at', e.target.value)} className={fieldClass(shownError('paid_at'))} />
                                {errorLine('paid_at')}
                            </label>
                            <label className="block text-sm font-medium text-gray-800 sm:col-span-2">{t('MoMo transaction ID')}
                                <input value={data.payment_reference} onChange={e => setData('payment_reference', e.target.value.replace(/[^\d\s]/g, ''))} inputMode="numeric" placeholder="1234567890"
                                    aria-describedby="assign-momo-txn-help" className={`${fieldClass(shownError('payment_reference'))} font-mono tracking-wide`} />
                                <span id="assign-momo-txn-help" className="mt-1 block text-xs font-normal text-gray-500">{t('In the MoMo SMS, after "Financial Transaction Id" or "TxId".')}</span>
                                {errorLine('payment_reference')}
                            </label>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-800">{t('Screenshot of the MoMo SMS')} <span className="font-normal text-gray-500">({t('optional')})</span></p>
                            <label className={`mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm transition focus-within:ring-2 focus-within:ring-[#0E3B2E]/30 ${data.payment_proof ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-300 hover:border-[#0E3B2E]/40 hover:bg-gray-50'}`}>
                                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={e => setData('payment_proof', e.target.files?.[0] || null)} />
                                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-[#0E3B2E] ring-1 ring-gray-200" aria-hidden="true">{data.payment_proof ? <FileCheck size={17} /> : <Upload size={17} />}</span>
                                <span className="min-w-0">
                                    <span className="block truncate font-semibold text-gray-900">{data.payment_proof ? data.payment_proof.name : t('Choose a file')}</span>
                                    <span className="block text-xs text-gray-600">{t('JPG, PNG or PDF, up to 5 MB')}</span>
                                </span>
                            </label>
                            {errorLine('payment_proof')}
                        </div>
                        {monthly && (
                            <button type="button" onClick={() => { setMomoMode('request'); setData('payment_reference', ''); }} className="block text-xs font-semibold text-[#0E3B2E] underline underline-offset-2">
                                {t('Send a payment request to the tenant’s phone instead')}
                            </button>
                        )}
                    </div>
                )}
                {paymentMethod && !phoneRequest && !momoPay && (
                    <label className="mt-4 block animate-fade-in text-sm font-medium text-gray-800">
                        {t(paymentMethod.reference)}
                        <span className="relative block">
                            <paymentMethod.icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <input required value={data.payment_reference} maxLength={255} onChange={e => setData('payment_reference', e.target.value)}
                                aria-describedby="assign-reference-hint" className={`${fieldClass(shownError('payment_reference'))} pl-10 font-mono tracking-wide`} />
                        </span>
                        <span id="assign-reference-hint" className="mt-1 block text-xs font-normal text-gray-500">{t(paymentMethod.hint)}</span>
                        {errorLine('payment_reference')}
                    </label>
                )}
                <p className="mt-3 text-xs text-gray-500">{t('Agreement reference')}: {t('Generated automatically after saving')}</p>
            </Step>

            {/* 5. Lease */}
            <Step id="lease" number={5} title={t('Signed lease')} done={done.lease} icon={FileText}>
                <input ref={leaseInput} type="file" accept={LEASE_TYPES} className="hidden" tabIndex={-1} aria-hidden="true"
                    onChange={e => { pickLease(e.target.files?.[0]); e.target.value = ''; }} />
                {data.lease ? (
                    <div className="flex animate-fade-in items-center gap-3 rounded-2xl border border-green-200 bg-green-50/60 p-3.5">
                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-green-600 text-white"><FileText size={18} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-gray-900">{data.lease.name}</span>
                            <span className="block text-xs text-gray-600">{(data.lease.size / 1024 / 1024).toFixed(2)} MB</span>
                        </span>
                        <button type="button" onClick={() => leaseInput.current?.click()} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0E3B2E] hover:bg-white">{t('Change')}</button>
                        <button type="button" onClick={() => setData('lease', null)} className="rounded-lg p-1.5 text-gray-500 hover:bg-white" aria-label={t('Remove the lease file')}><X size={16} aria-hidden="true" /></button>
                    </div>
                ) : (
                    <button type="button" onClick={() => leaseInput.current?.click()}
                        onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pickLease(e.dataTransfer.files?.[0]); }}
                        className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-7 text-center transition-colors hover:border-[#0E3B2E]/60 hover:bg-[#0E3B2E]/[0.03] ${shownError('lease') ? 'border-red-300 bg-red-50/40' : 'border-gray-300 bg-gray-50'}`}>
                        <Upload size={24} className="text-[#0E3B2E]" aria-hidden="true" />
                        <span className="mt-2 text-sm font-semibold text-gray-900">{t('Upload the signed lease')}</span>
                        <span className="mt-0.5 text-xs text-gray-600">{t('PDF, Word or photo · up to 10 MB')}</span>
                    </button>
                )}
                {(leaseNotice || shownError('lease')) && <p className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} aria-hidden="true" />{leaseNotice || shownError('lease')}</p>}

                <div className="mt-5">
                    <LeaseNoteField
                        value={data.lease_notes}
                        onChange={value => setData('lease_notes', value)}
                        routeName="properties.units.tenancy.lease-notes.generate"
                        routeParams={selectedUnit ? [selectedUnit.property_id, selectedUnit.id] : []}
                        payload={{
                            start_date: data.start_date,
                            end_date: data.end_date,
                            check_in_time: dailyStay ? data.check_in_time : null,
                            check_out_time: dailyStay ? data.check_out_time : null,
                            monthly_rent: data.monthly_rent,
                            rent_frequency: data.rent_frequency,
                            deposit_amount: monthly ? data.monthly_rent : data.deposit_amount,
                        }}
                        disabled={!selectedUnit || !data.start_date || !data.end_date || !data.monthly_rent}
                    />
                </div>
            </Step>

            {Object.keys(errors).filter(field => !sections.some(s => s.fields.includes(field))).map(field => (
                <p key={field} role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle size={16} className="mt-0.5 flex-none" aria-hidden="true" />{errors[field]}</p>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
                <p className="text-xs text-gray-500">{t('Tenant identity and contact details will be reused from this profile.')}</p>
                <button disabled={processing}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#124B3A] disabled:opacity-60">
                    {processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Building2 size={16} aria-hidden="true" />}
                    {processing ? t('Saving tenancy…') : t('Assign unit and create lease')}
                </button>
            </div>
        </form>
    );
}

function Step({ id, number, title, done, icon: Icon, children }) {
    const { t } = useTranslation();

    return (
        <section id={`assign-${id}`} aria-labelledby={`assign-${id}-title`}
            className={`scroll-mt-24 rounded-2xl border p-4 transition-colors duration-300 sm:p-5 ${done ? 'border-green-200 bg-green-50/25' : 'border-gray-200 bg-white'}`}>
            <h3 id={`assign-${id}-title`} className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-gray-900">
                <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl transition-colors duration-300 ${done ? 'bg-green-600 text-white' : 'bg-[#0E3B2E]/10 text-[#0E3B2E]'}`}>
                    {done ? <CheckCircle2 size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                </span>
                <span><span className="text-gray-500">{number}.</span> {title}</span>
                <span className="ml-auto">
                    {done
                        ? <span className="inline-flex animate-pop-in items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"><CheckCircle2 size={13} aria-hidden="true" />{t('Done')}</span>
                        : <span className="sr-only">{t('not complete')}</span>}
                </span>
            </h3>
            {children}
        </section>
    );
}

function Stat({ label, value, hint }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium text-gray-600">{label}</p>
            <p className="mt-0.5 font-[Sora] text-lg font-bold text-gray-900">{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>}
        </div>
    );
}
