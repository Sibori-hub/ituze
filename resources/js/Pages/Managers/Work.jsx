import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useTranslation } from '@/localization';
import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, Building2, Clock3, CreditCard, Eye, Layers, Lock, ShieldCheck, TrendingUp, UserCog, Users } from 'lucide-react';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

/**
 * The owner's private, read-only view of each manager's work, kept apart from
 * the owner's own dashboard: buildings, this month's money, overdue rent,
 * tenants, latest payments and latest actions.
 */
export default function ManagersWork({ managers = [], month }) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const date = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(String(value).length === 10 ? `${value}T12:00:00` : value)) : '—');
    const monthName = month ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${month}T12:00:00`)) : '';

    return (
        <AuthenticatedLayout header="Managers’ work">
            <Head title={t('Managers’ work')} />
            <div className="mx-auto max-w-7xl space-y-5">
                <section className="flex flex-wrap items-start gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-sky-100 text-sky-900" aria-hidden="true"><Eye size={22} /></span>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Your managers’ work')}</h1>
                        <p className="mt-1 text-sm text-gray-600">{t('What each manager does in the buildings you gave them, for :month. These figures are kept apart from your own dashboard.', { month: monthName })}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"><Lock size={12} aria-hidden="true" />{t('Private · read only')}</span>
                </section>

                {managers.length === 0 ? (
                    <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
                        <UserCog className="mx-auto text-gray-400" size={28} aria-hidden="true" />
                        <p className="mt-3 font-semibold text-gray-900">{t('No manager yet')}</p>
                        <Link href={route('managers.index')} className="mt-3 inline-flex rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A]">{t('Add a manager')}</Link>
                    </div>
                ) : managers.map((manager) => (
                    <article key={manager.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                        <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
                            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-[#0E3B2E] to-[#1F7A5A] font-[Sora] font-bold text-white" aria-hidden="true">{manager.name?.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                            <div className="min-w-0 flex-1">
                                <h2 className="flex flex-wrap items-center gap-2 font-[Sora] text-lg font-bold text-gray-900">
                                    {manager.name}
                                    {manager.disabled && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{t('Disabled')}</span>}
                                </h2>
                                <ul className="mt-1 flex flex-wrap gap-1.5">
                                    {manager.runs.map((run) => (
                                        <li key={`${run.property_id}-${run.label}`} className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ring-1 ${run.whole ? 'bg-emerald-50 text-emerald-900 ring-emerald-100' : 'bg-sky-50 text-sky-900 ring-sky-100'}`}>
                                            {run.whole ? <Building2 size={12} aria-hidden="true" /> : <Layers size={12} aria-hidden="true" />}
                                            <Link href={route('properties.show', run.property_id)} className="hover:underline">{run.label}</Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </header>

                        <dl className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-5">
                            {[
                                [t('Rent collected'), money(manager.month.rent), CreditCard, 'text-emerald-800'],
                                [t('Your income'), money(manager.month.income), TrendingUp, 'text-[#0E3B2E]'],
                                [t('Deposits received'), money(manager.month.deposits), ShieldCheck, 'text-violet-800'],
                                [t('Overdue rent'), money(manager.arrears.total), AlertTriangle, Number(manager.arrears.total) > 0 ? 'text-red-700' : 'text-gray-700'],
                                [t('Active tenants'), manager.tenants, Users, 'text-gray-900'],
                            ].map(([label, value, Icon, tone]) => (
                                <div key={label} className="bg-white px-4 py-3">
                                    <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"><Icon size={13} aria-hidden="true" />{label}</dt>
                                    <dd className={`mt-1 font-[Sora] text-lg font-bold tabular-nums ${tone}`}>{value}</dd>
                                </div>
                            ))}
                        </dl>

                        <div className="grid gap-px bg-gray-100 lg:grid-cols-2">
                            <section className="bg-white p-5" aria-label={t('Latest payments')}>
                                <h3 className="text-sm font-semibold text-gray-900">{t('Latest payments')}</h3>
                                {manager.recent_payments.length ? (
                                    <table className="mt-2 w-full text-xs">
                                        <thead className="text-gray-500">
                                            <tr>
                                                <th scope="col" className="py-1 text-left font-semibold">{t('Date')}</th>
                                                <th scope="col" className="py-1 text-left font-semibold">{t('Tenant')}</th>
                                                <th scope="col" className="py-1 text-right font-semibold">{t('Rent')}</th>
                                                <th scope="col" className="py-1 text-right font-semibold">{t('Deposit')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {manager.recent_payments.map((payment) => (
                                                <tr key={payment.id} className="text-gray-800">
                                                    <td className="py-1.5">{date(payment.paid_at)}</td>
                                                    <td className="py-1.5"><span className="font-medium">{payment.tenant}</span> <span className="text-gray-500">· {payment.property} {payment.unit}</span></td>
                                                    <td className="py-1.5 text-right tabular-nums text-emerald-800">{payment.rent ? money(payment.rent) : '—'}</td>
                                                    <td className="py-1.5 text-right tabular-nums text-violet-800">{payment.deposit ? money(payment.deposit) : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : <p className="mt-2 text-xs text-gray-600">{t('No payment in the last three months.')}</p>}
                            </section>
                            <section className="bg-white p-5" aria-label={t('Latest actions')}>
                                <h3 className="text-sm font-semibold text-gray-900">{t('Latest actions')}</h3>
                                {manager.activity.length ? (
                                    <ol className="mt-2 space-y-2 text-xs">
                                        {manager.activity.map((item) => (
                                            <li key={item.id} className="flex gap-2">
                                                <Clock3 size={13} className="mt-0.5 flex-none text-gray-400" aria-hidden="true" />
                                                <span className="min-w-0 flex-1 text-gray-800">{item.description}<span className="block text-gray-500">{date(item.at)}{item.property ? ` · ${item.property}` : ''}</span></span>
                                                {item.amount !== null && item.amount !== undefined && <span className="font-semibold tabular-nums text-emerald-800">{money(item.amount)}</span>}
                                            </li>
                                        ))}
                                    </ol>
                                ) : <p className="mt-2 text-xs text-gray-600">{t('Nothing done yet.')}</p>}
                            </section>
                        </div>
                    </article>
                ))}
                <p className="text-center text-xs text-gray-500">{t('Deposits are the tenants’ money, held until they move out: they are not part of your income.')}</p>
            </div>
        </AuthenticatedLayout>
    );
}
