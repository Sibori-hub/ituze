import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmActionModal from '@/Components/ConfirmActionModal';
import RwandaFlag from '@/Components/RwandaFlag';
import usePresence from '@/hooks/usePresence';
import { displayPhone, formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { useTranslation } from '@/localization';
import { Head, router, useForm } from '@inertiajs/react';
import {
    Activity, AlertCircle, Building2, CheckCircle2, ChevronDown, Clock3, CreditCard, Eye, EyeOff, KeyRound, Layers,
    Loader2, Mail, Pencil, Phone, Power, RefreshCw, ShieldCheck, Trash2, UserCog, UserPlus, Users, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const fieldClass = (invalid) => `mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;

/** A readable temporary password: letters, digits and a symbol. */
function makePassword() {
    const pick = (chars, n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${pick('ABCDEFGHJKLMNPQRSTUVWXYZ', 2)}${pick('abcdefghijkmnpqrstuvwxyz', 4)}${pick('23456789', 3)}${pick('@#$%', 1)}`;
}

export default function ManagersIndex({ owner, canManage, adminView = false, managers = [], properties = [], activity, filters = {} }) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const when = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—');
    // An admin looking at an owner's team keeps that owner in every request.
    const ownerQuery = (params = {}) => ({ ...params, ...(adminView ? { owner_id: owner.id } : {}) });

    const [editing, setEditing] = useState(null); // null | 'new' | manager
    const [passwordFor, setPasswordFor] = useState(null);
    const [confirm, setConfirm] = useState(null); // { manager, action }
    const [busy, setBusy] = useState(false);

    const active = managers.filter((manager) => !manager.disabled).length;
    const collected = managers.reduce((sum, manager) => sum + Number(manager.collected_this_month || 0), 0);
    const actions = managers.reduce((sum, manager) => sum + Number(manager.actions_30_days || 0), 0);

    const runConfirmed = () => {
        if (!confirm) return;
        const { manager, action } = confirm;
        setBusy(true);
        const options = { preserveScroll: true, onFinish: () => { setBusy(false); setConfirm(null); } };
        if (action === 'remove') router.delete(route('managers.destroy', ownerQuery({ manager: manager.id })), options);
        else router.post(route(action === 'disable' ? 'managers.disable' : 'managers.enable', ownerQuery({ manager: manager.id })), {}, options);
    };

    const filter = (changes) => router.get(route('managers.index'), ownerQuery({ ...filters, ...changes }), { preserveScroll: true, preserveState: true, replace: true });

    return (
        <AuthenticatedLayout header="Managers">
            <Head title={t('Managers')} />
            <div className="mx-auto max-w-7xl space-y-5">
                {/* Heading */}
                <section className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-7">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#D9A441]/15 blur-3xl" />
                    <div className="relative flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white shadow-sm" aria-hidden="true"><UserCog size={22} /></span>
                            <div>
                                <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Managers')}</h1>
                                <p className="mt-1 max-w-2xl text-sm text-gray-600">
                                    {t('Give trusted people the buildings or units they run. They work like you on what you give them, and you can follow everything they do.')}
                                </p>
                                {adminView && <p className="mt-2 text-xs font-semibold text-amber-900">{t('Team of :owner', { owner: owner?.name })}</p>}
                            </div>
                        </div>
                        {canManage && (
                            <button type="button" onClick={() => setEditing('new')} disabled={!properties.length}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(14,59,46,0.8)] transition hover:bg-[#124B3A] disabled:cursor-not-allowed disabled:opacity-50">
                                <UserPlus size={17} aria-hidden="true" /> {t('Add manager')}
                            </button>
                        )}
                    </div>
                    {!properties.length && <p className="relative mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">{t('Add a property first; then you can give it to a manager.')}</p>}
                </section>

                {/* Summary */}
                <section aria-label={t('Team summary')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        { label: 'Managers', value: managers.length, icon: Users, tone: 'bg-emerald-50 text-emerald-800 ring-emerald-100' },
                        { label: 'Can sign in', value: active, icon: ShieldCheck, tone: 'bg-sky-50 text-sky-800 ring-sky-100' },
                        { label: 'Rent they recorded this month', value: money(collected), icon: CreditCard, tone: 'bg-amber-50 text-amber-800 ring-amber-100' },
                        { label: 'Actions in 30 days', value: actions, icon: Activity, tone: 'bg-violet-50 text-violet-800 ring-violet-100' },
                    ].map(({ label, value, icon: Icon, tone }) => (
                        <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] sm:p-5">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${tone}`} aria-hidden="true"><Icon size={17} /></span>
                            <p className="mt-3 font-[Sora] text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">{value}</p>
                            <p className="mt-0.5 text-xs font-medium text-gray-600 sm:text-sm">{t(label)}</p>
                        </div>
                    ))}
                </section>

                {/* Team */}
                <section aria-labelledby="team-title">
                    <h2 id="team-title" className="sr-only">{t('Your managers')}</h2>
                    {managers.length ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {managers.map((manager) => (
                                <article key={manager.id} className={`rounded-2xl bg-white p-5 shadow-sm ring-1 transition ${manager.disabled ? 'ring-gray-200 opacity-80' : 'ring-black/[0.04] hover:shadow-md'}`}>
                                    <div className="flex items-start gap-3">
                                        <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-2xl font-[Sora] text-base font-bold ${manager.disabled ? 'bg-gray-100 text-gray-500' : 'bg-gradient-to-br from-[#0E3B2E] to-[#1F7A5A] text-white'}`} aria-hidden="true">
                                            {(manager.first_name?.[0] || '') + (manager.last_name?.[0] || '')}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate font-semibold text-gray-900">{manager.name}</h3>
                                                {manager.disabled
                                                    ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{t('Disabled')}</span>
                                                    : manager.must_change_password
                                                        ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">{t('Not signed in yet')}</span>
                                                        : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-100">{t('Active')}</span>}
                                            </div>
                                            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                                                <a href={`mailto:${manager.email}`} className="inline-flex items-center gap-1 hover:text-[#0E3B2E]"><Mail size={12} aria-hidden="true" />{manager.email}</a>
                                                <a href={`tel:${manager.phone}`} className="inline-flex items-center gap-1 hover:text-[#0E3B2E]"><Phone size={12} aria-hidden="true" />{displayPhone(manager.phone)}</a>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('Runs')}</p>
                                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                                            {manager.assignments.map((assignment) => (
                                                <li key={`${assignment.property_id}-${assignment.property_unit_id ?? 'all'}`} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ring-1 ${assignment.property_unit_id ? 'bg-sky-50 text-sky-900 ring-sky-100' : 'bg-emerald-50 text-emerald-900 ring-emerald-100'}`}>
                                                    {assignment.property_unit_id ? <Layers size={12} aria-hidden="true" /> : <Building2 size={12} aria-hidden="true" />}
                                                    {assignment.label}{!assignment.property_unit_id && <span className="text-emerald-700"> · {t('whole building')}</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center">
                                        <div><dt className="text-[11px] text-gray-600">{t('Recorded this month')}</dt><dd className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">{money(manager.collected_this_month)}</dd></div>
                                        <div><dt className="text-[11px] text-gray-600">{t('Actions (30 days)')}</dt><dd className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">{manager.actions_30_days}</dd></div>
                                        <div><dt className="text-[11px] text-gray-600">{t('Last activity')}</dt><dd className="mt-0.5 text-xs font-semibold text-gray-900">{when(manager.last_activity_at)}</dd></div>
                                    </dl>

                                    {canManage && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <button type="button" onClick={() => setEditing(manager)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"><Pencil size={13} aria-hidden="true" />{t('Edit & buildings')}</button>
                                            <button type="button" onClick={() => filter({ manager_id: manager.id, page: undefined })} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"><Activity size={13} aria-hidden="true" />{t('Activity')}</button>
                                            <button type="button" onClick={() => setPasswordFor(manager)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"><KeyRound size={13} aria-hidden="true" />{t('New password')}</button>
                                            <button type="button" onClick={() => setConfirm({ manager, action: manager.disabled ? 'enable' : 'disable' })} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${manager.disabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'}`}><Power size={13} aria-hidden="true" />{manager.disabled ? t('Enable') : t('Disable')}</button>
                                            <button type="button" onClick={() => setConfirm({ manager, action: 'remove' })} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 size={13} aria-hidden="true" />{t('Remove')}</button>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
                            <UserCog size={30} className="mx-auto text-gray-300" aria-hidden="true" />
                            <p className="mt-3 font-semibold text-gray-900">{t('No managers yet')}</p>
                            <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">{t('Add a manager to let someone run some of your buildings for you. Managers are free.')}</p>
                        </div>
                    )}
                </section>

                {/* Activity */}
                <section aria-labelledby="activity-title" className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 px-5 py-4">
                        <div>
                            <h2 id="activity-title" className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><Clock3 size={17} className="text-[#1F7A5A]" aria-hidden="true" />{t('Activity')}</h2>
                            <p className="mt-0.5 text-xs text-gray-600">{t('Everything done in your buildings, newest first.')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <label className="text-xs font-semibold text-gray-700">
                                <span className="sr-only">{t('Who')}</span>
                                <select value={filters.manager_id || ''} onChange={(event) => filter({ manager_id: event.target.value || undefined, page: undefined })} className="rounded-xl border-gray-300 py-2 text-sm">
                                    <option value="">{t('Everyone')}</option>
                                    {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
                                </select>
                            </label>
                            <label className="text-xs font-semibold text-gray-700">
                                <span className="sr-only">{t('Period')}</span>
                                <select value={filters.days || 30} onChange={(event) => filter({ days: event.target.value, page: undefined })} className="rounded-xl border-gray-300 py-2 text-sm">
                                    {[7, 30, 90, 365].map((days) => <option key={days} value={days}>{t('Last :days days', { days })}</option>)}
                                </select>
                            </label>
                        </div>
                    </div>
                    {activity?.data?.length ? (
                        <ol className="divide-y divide-gray-100">
                            {activity.data.map((item) => (
                                <li key={item.id} className="flex gap-3 px-5 py-3">
                                    <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold ${item.actor?.role === 'manager' ? 'bg-sky-100 text-sky-900' : item.actor?.role === 'admin' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`} aria-hidden="true">
                                        {(item.actor?.name || '?').split(' ').map((part) => part[0]).slice(0, 2).join('')}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-gray-900">
                                            <span className="font-semibold">{item.actor?.name || t('Someone')}</span>
                                            <span className="text-gray-500"> · {t(item.actor?.role === 'manager' ? 'Manager' : item.actor?.role === 'admin' ? 'Administrator' : 'Owner')}</span>
                                        </p>
                                        <p className="mt-0.5 text-sm text-gray-700">{item.description}</p>
                                        <p className="mt-0.5 text-xs text-gray-500">{when(item.at)}{item.property ? ` · ${item.property}` : ''}</p>
                                    </div>
                                    {item.amount !== null && item.amount !== undefined && <span className="shrink-0 self-center font-semibold tabular-nums text-emerald-800">{money(item.amount)}</span>}
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="px-5 py-8 text-center text-sm text-gray-600">{t('Nothing recorded in this period yet.')}</p>
                    )}
                    {activity?.last_page > 1 && (
                        <nav aria-label={t('Activity pages')} className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm">
                            <span className="text-gray-600">{t('Page :page of :pages', { page: activity.current_page, pages: activity.last_page })}</span>
                            <div className="flex gap-2">
                                <button type="button" disabled={!activity.prev_page_url} onClick={() => filter({ page: activity.current_page - 1 })} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40">{t('Previous')}</button>
                                <button type="button" disabled={!activity.next_page_url} onClick={() => filter({ page: activity.current_page + 1 })} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40">{t('Next')}</button>
                            </div>
                        </nav>
                    )}
                </section>
            </div>

            <ManagerDialog
                open={editing !== null}
                manager={editing && editing !== 'new' ? editing : null}
                properties={properties}
                ownerQuery={ownerQuery}
                onClose={() => setEditing(null)}
            />
            <PasswordDialog manager={passwordFor} ownerQuery={ownerQuery} onClose={() => setPasswordFor(null)} />
            <ConfirmActionModal
                open={confirm !== null}
                title={confirm?.action === 'remove' ? t('Remove :name?', { name: confirm?.manager.name }) : confirm?.action === 'disable' ? t('Disable :name?', { name: confirm?.manager.name }) : t('Enable :name?', { name: confirm?.manager.name })}
                message={confirm?.action === 'remove'
                    ? t('They can no longer sign in. Everything they recorded stays in your history.')
                    : confirm?.action === 'disable'
                        ? t('They are signed out now and cannot sign in until you enable them again.')
                        : t('They can sign in again with their current password.')}
                confirmLabel={confirm?.action === 'remove' ? t('Remove') : confirm?.action === 'disable' ? t('Disable') : t('Enable')}
                tone={confirm?.action === 'enable' ? 'default' : 'danger'}
                processing={busy}
                onConfirm={runConfirmed}
                onCancel={() => setConfirm(null)}
            />
        </AuthenticatedLayout>
    );
}

/** Add or edit a manager, with the buildings and units they run. */
function ManagerDialog({ open, manager, properties, ownerQuery, onClose }) {
    const { t } = useTranslation();
    const { mounted, closing } = usePresence(open);
    const isNew = !manager;
    const form = useForm({ first_name: '', last_name: '', email: '', phone: '', password: '', password_confirmation: '', assignments: [] });
    const { data, setData, errors, processing, clearErrors } = form;
    const [showPassword, setShowPassword] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [expanded, setExpanded] = useState({});

    useEffect(() => {
        if (!open) return;
        clearErrors();
        setSubmitted(false);
        const password = makePassword();
        form.setData({
            first_name: manager?.first_name || '',
            last_name: manager?.last_name || '',
            email: manager?.email || '',
            phone: manager?.phone || '',
            password: isNew ? password : '',
            password_confirmation: isNew ? password : '',
            assignments: (manager?.assignments || []).map(({ property_id, property_unit_id }) => ({ property_id, property_unit_id })),
        });
        setExpanded(Object.fromEntries((manager?.assignments || []).filter((a) => a.property_unit_id).map((a) => [a.property_id, true])));
    }, [open, manager?.id]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => event.key === 'Escape' && !processing && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, processing]);

    const has = (propertyId, unitId = null) => data.assignments.some((a) => a.property_id === propertyId && (a.property_unit_id ?? null) === unitId);
    const toggleWhole = (property) => {
        const whole = has(property.id);
        setData('assignments', whole
            ? data.assignments.filter((a) => a.property_id !== property.id)
            : [...data.assignments.filter((a) => a.property_id !== property.id), { property_id: property.id, property_unit_id: null }]);
    };
    const toggleUnit = (property, unit) => {
        const rest = data.assignments.filter((a) => !(a.property_id === property.id && a.property_unit_id === unit.id));
        setData('assignments', has(property.id, unit.id) ? rest : [...rest.filter((a) => !(a.property_id === property.id && a.property_unit_id === null)), { property_id: property.id, property_unit_id: unit.id }]);
    };

    const phoneDigits = toLocalDigits(data.phone);
    const phoneValid = RWANDA_MOBILE_REGEX.test(phoneDigits);
    const clientErrors = useMemo(() => {
        const found = {};
        if (!data.first_name.trim()) found.first_name = t('Enter the first name.');
        if (!data.last_name.trim()) found.last_name = t('Enter the last name.');
        if (!/^\S+@\S+\.\S+$/.test(data.email.trim())) found.email = t('Enter a valid email address.');
        if (!phoneValid) found.phone = t('Enter 10 digits starting with 078, 079, 072, or 073.');
        if (isNew && !(data.password.length >= 10 && /[a-z]/.test(data.password) && /[A-Z]/.test(data.password) && /\d/.test(data.password) && /[^A-Za-z0-9]/.test(data.password))) found.password = t('Use at least 10 characters with upper and lower case letters, a number and a symbol.');
        if (isNew && data.password !== data.password_confirmation) found.password_confirmation = t('The two passwords do not match.');
        if (!data.assignments.length) found.assignments = t('Give the manager at least one property or unit.');
        return found;
    }, [data, phoneValid, isNew, t]);
    const errorFor = (field) => errors[field] || (submitted ? clientErrors[field] : null);

    const submit = (event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(clientErrors).length) return;
        const options = { preserveScroll: true, onSuccess: () => onClose() };
        if (isNew) form.post(route('managers.store', ownerQuery()), options);
        else form.transform(({ password, password_confirmation, ...rest }) => rest).put(route('managers.update', ownerQuery({ manager: manager.id })), options);
    };

    if (!mounted) return null;
    const error = (field) => errorFor(field) && <span className="mt-1 flex items-center gap-1 text-xs font-normal text-red-600"><AlertCircle size={12} aria-hidden="true" />{errorFor(field)}</span>;
    const chosenCount = data.assignments.length;

    return createPortal(
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6 ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`}>
            <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="manager-dialog-title"
                className={`flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ${closing ? 'animate-pop-out' : 'animate-pop-in'}`}>
                <div className="relative border-b border-gray-100 bg-gradient-to-br from-[#0E3B2E]/[0.06] via-white to-amber-50/60 px-6 pb-5 pt-6">
                    <div className="flex items-start gap-4 pr-8">
                        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white shadow-md" aria-hidden="true">{isNew ? <UserPlus size={22} /> : <Pencil size={20} />}</span>
                        <div>
                            <h2 id="manager-dialog-title" className="font-[Sora] text-xl font-bold text-gray-900">{isNew ? t('Add manager') : t('Edit :name', { name: manager.name })}</h2>
                            <p className="mt-1 text-sm text-gray-600">{isNew ? t('They sign in with their email and the temporary password, then choose their own password.') : t('Change their details or the buildings they run.')}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label={t('Close')} className="absolute right-4 top-4 rounded-xl p-2 text-gray-500 hover:bg-white hover:text-gray-800"><X size={20} aria-hidden="true" /></button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-gray-800">{t('First name')}
                            <input value={data.first_name} onChange={(e) => setData('first_name', e.target.value)} autoComplete="off" className={fieldClass(errorFor('first_name'))} aria-invalid={errorFor('first_name') ? 'true' : undefined} />
                            {error('first_name')}
                        </label>
                        <label className="text-sm font-medium text-gray-800">{t('Last name')}
                            <input value={data.last_name} onChange={(e) => setData('last_name', e.target.value)} autoComplete="off" className={fieldClass(errorFor('last_name'))} aria-invalid={errorFor('last_name') ? 'true' : undefined} />
                            {error('last_name')}
                        </label>
                        <label className="text-sm font-medium text-gray-800">{t('Email (used to sign in)')}
                            <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value.toLowerCase())} autoComplete="off" className={fieldClass(errorFor('email'))} aria-invalid={errorFor('email') ? 'true' : undefined} />
                            {error('email')}
                        </label>
                        <div className="text-sm font-medium text-gray-800">
                            <label htmlFor="manager-phone">{t('Phone')}</label>
                            <div className={`mt-1.5 flex items-stretch overflow-hidden rounded-xl border bg-white shadow-sm focus-within:ring-2 ${errorFor('phone') ? 'border-red-400 focus-within:ring-red-500/20' : 'border-gray-300 focus-within:border-[#0E3B2E] focus-within:ring-[#0E3B2E]/15'}`}>
                                <span className="flex select-none items-center gap-2 border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700"><RwandaFlag className="h-[15px] w-[22px]" />+250</span>
                                <input id="manager-phone" type="tel" inputMode="numeric" value={formatPhone(phoneDigits)} placeholder="788 123 456"
                                    onChange={(e) => { const digits = toLocalDigits(e.target.value); setData('phone', digits ? `0${digits}` : ''); }}
                                    aria-invalid={errorFor('phone') ? 'true' : undefined}
                                    className="w-full min-w-0 border-0 bg-transparent px-3 py-2.5 text-sm tracking-wide focus:ring-0" />
                            </div>
                            {phoneValid && !errorFor('phone') && <span className="mt-1 block text-xs font-normal text-green-700">{t(':network number', { network: getNetwork(phoneDigits) })}</span>}
                            {error('phone')}
                        </div>
                    </div>

                    {isNew && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="flex items-center gap-2 text-sm font-semibold text-amber-950"><KeyRound size={16} aria-hidden="true" />{t('Temporary password')}</p>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 ring-1 ring-amber-200">{showPassword ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}{showPassword ? t('Hide') : t('Show')}</button>
                                    <button type="button" onClick={() => { const p = makePassword(); setData((current) => ({ ...current, password: p, password_confirmation: p })); }} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 ring-1 ring-amber-200"><RefreshCw size={13} aria-hidden="true" />{t('New one')}</button>
                                </div>
                            </div>
                            <input type={showPassword ? 'text' : 'password'} value={data.password} onChange={(e) => setData((current) => ({ ...current, password: e.target.value, password_confirmation: e.target.value }))}
                                aria-label={t('Temporary password')} className={`${fieldClass(errorFor('password'))} font-mono tracking-wide`} />
                            {error('password')}
                            <p className="mt-2 text-xs text-amber-900">{t('Write it down and give it to the manager with their email. They must change it the first time they sign in.')}</p>
                        </div>
                    )}

                    <fieldset>
                        <legend className="flex w-full items-center justify-between text-sm font-semibold text-gray-900">
                            <span className="flex items-center gap-2"><Building2 size={16} className="text-[#0E3B2E]" aria-hidden="true" />{t('Buildings and units they run')}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chosenCount ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{t(':count chosen', { count: chosenCount })}</span>
                        </legend>
                        <p className="mt-1 text-xs text-gray-600">{t('Tick a whole building, or open it and tick only some units.')}</p>
                        <ul className="mt-3 space-y-2">
                            {properties.map((property) => {
                                const whole = has(property.id);
                                const someUnits = data.assignments.filter((a) => a.property_id === property.id && a.property_unit_id).length;
                                const isOpen = expanded[property.id];
                                return (
                                    <li key={property.id} className={`rounded-xl border transition ${whole || someUnits ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200'}`}>
                                        <div className="flex items-center gap-3 px-3 py-2.5">
                                            <input id={`prop-${property.id}`} type="checkbox" checked={whole} onChange={() => toggleWhole(property)} className="h-4 w-4 rounded border-gray-300 text-[#0E3B2E] focus:ring-[#0E3B2E]" />
                                            <label htmlFor={`prop-${property.id}`} className="min-w-0 flex-1 cursor-pointer">
                                                <span className="block truncate text-sm font-semibold text-gray-900">{property.name}</span>
                                                <span className="block text-xs text-gray-600">{whole ? t('Whole building · :rooms rooms', { rooms: property.rooms }) : someUnits ? t(someUnits === 1 ? '1 unit chosen' : ':count units chosen', { count: someUnits }) : t(':rooms rooms', { rooms: property.rooms })}</span>
                                            </label>
                                            {property.units.length > 0 && (
                                                <button type="button" onClick={() => setExpanded((current) => ({ ...current, [property.id]: !current[property.id] }))} aria-expanded={!!isOpen}
                                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0E3B2E] hover:bg-[#0E3B2E]/10">
                                                    {t('Units')} <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                                </button>
                                            )}
                                        </div>
                                        {isOpen && (
                                            <ul className="grid gap-1.5 border-t border-gray-200/70 px-3 py-2.5 sm:grid-cols-2">
                                                {property.units.map((unit) => (
                                                    <li key={unit.id}>
                                                        <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${whole ? 'text-gray-400' : 'text-gray-800 hover:bg-white'}`}>
                                                            <input type="checkbox" disabled={whole} checked={whole || has(property.id, unit.id)} onChange={() => toggleUnit(property, unit)} className="h-4 w-4 rounded border-gray-300 text-[#0E3B2E] focus:ring-[#0E3B2E]" />
                                                            <span className="min-w-0 flex-1 truncate">{unit.label}</span>
                                                            <span className="text-xs text-gray-500">{t(':rooms rooms', { rooms: unit.rooms })}</span>
                                                        </label>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        {error('assignments')}
                    </fieldset>
                </div>

                <div className="flex gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4">
                    <button type="button" onClick={onClose} disabled={processing} className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:flex-none sm:px-6">{t('Cancel')}</button>
                    <button disabled={processing} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60 sm:ml-auto sm:flex-none">
                        {processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                        {processing ? t('Saving…') : isNew ? t('Add manager') : t('Save changes')}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}

/** Give a manager a new temporary password. */
function PasswordDialog({ manager, ownerQuery, onClose }) {
    const { t } = useTranslation();
    const open = manager !== null;
    const { mounted, closing } = usePresence(open);
    const form = useForm({ password: '', password_confirmation: '' });
    const [shown, setShown] = useState(null);

    useEffect(() => {
        if (open) {
            const p = makePassword();
            form.setData({ password: p, password_confirmation: p });
            form.clearErrors();
            setShown(manager);
        }
    }, [open]);

    if (!mounted) return null;
    const submit = (event) => {
        event.preventDefault();
        form.post(route('managers.password', ownerQuery({ manager: shown.id })), { preserveScroll: true, onSuccess: () => onClose() });
    };

    return createPortal(
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`}>
            <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="password-dialog-title" className={`w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ${closing ? 'animate-pop-out' : 'animate-pop-in'}`}>
                <h2 id="password-dialog-title" className="flex items-center gap-2 font-[Sora] text-lg font-bold text-gray-900"><KeyRound size={18} aria-hidden="true" />{t('New password for :name', { name: shown?.name })}</h2>
                <p className="mt-1 text-sm text-gray-600">{t('They are signed out and must change this password at their next sign-in.')}</p>
                <input value={form.data.password} onChange={(e) => form.setData({ password: e.target.value, password_confirmation: e.target.value })} aria-label={t('Temporary password')} className={`${fieldClass(form.errors.password)} font-mono tracking-wide`} />
                {form.errors.password && <p className="mt-1 text-xs text-red-600">{form.errors.password}</p>}
                <div className="mt-5 flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">{t('Cancel')}</button>
                    <button disabled={form.processing} className="flex-1 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{form.processing ? t('Saving…') : t('Set password')}</button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
