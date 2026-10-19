import { Percent } from 'lucide-react';
import { useTranslation } from '@/localization';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

/**
 * Month-by-month rent collected, Q.R.A management fee and the owner's net
 * payout, for owners whose buildings Q.R.A manages.
 */
export default function ManagementFeeReport({ report }) {
    const { t, language } = useTranslation();
    if (!report) return null;

    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const monthLabel = (value) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`));
    const rateLabel = report.rate !== null && report.rate !== undefined
        ? `${Number(report.rate).toLocaleString(locale, { maximumFractionDigits: 2 })}%`
        : t('per-owner rates');

    return (
        <section aria-labelledby="management-fee-title" className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#0E3B2E] ring-1 ring-emerald-200" aria-hidden="true">
                        <Percent size={18} />
                    </span>
                    <div>
                        <h2 id="management-fee-title" className="font-[Sora] font-semibold text-gray-900">{t('Management fee & payout')}</h2>
                        <p className="mt-1 text-sm text-gray-600">
                            {t('Q.R.A keeps :rate of the rent it collects. Deposits and damage charges are not included.', { rate: rateLabel })}
                        </p>
                    </div>
                </div>
            </div>

            <dl className="grid gap-px bg-gray-200 sm:grid-cols-3">
                {[
                    ['Rent collected', report.totals.collected, 'text-gray-900'],
                    ['Q.R.A fee', report.totals.fee, 'text-amber-800'],
                    ['Paid to owner', report.totals.net, 'text-emerald-800'],
                ].map(([label, value, tone]) => (
                    <div key={label} className="bg-white p-5">
                        <dt className="text-sm text-gray-600">{t(label)} <span className="text-gray-500">· {t('last 12 months')}</span></dt>
                        <dd className={`mt-1 font-[Sora] text-xl font-bold tabular-nums ${tone}`}>{money(value)}</dd>
                    </div>
                ))}
            </dl>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                    <caption className="sr-only">{t('Management fee & payout')}</caption>
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                        <tr>
                            <th scope="col" className="px-5 py-3 font-semibold">{t('Month')}</th>
                            <th scope="col" className="px-5 py-3 text-right font-semibold">{t('Rent collected')}</th>
                            <th scope="col" className="px-5 py-3 text-right font-semibold">{t('Q.R.A fee')}</th>
                            <th scope="col" className="px-5 py-3 text-right font-semibold">{t('Paid to owner')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {report.months.map((row) => (
                            <tr key={row.month} className={row.collected > 0 ? '' : 'text-gray-500'}>
                                <th scope="row" className="px-5 py-3 font-medium text-gray-900">{monthLabel(row.month)}</th>
                                <td className="px-5 py-3 text-right tabular-nums">{money(row.collected)}</td>
                                <td className="px-5 py-3 text-right tabular-nums text-amber-800">{money(row.fee)}</td>
                                <td className="px-5 py-3 text-right font-semibold tabular-nums text-emerald-800">{money(row.net)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
