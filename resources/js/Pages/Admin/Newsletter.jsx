import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmActionModal from '@/Components/ConfirmActionModal';
import { useTranslation } from '@/localization';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Download, Loader2, MailCheck, Search, Send, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

const TABS = [['all', 'All'], ['active', 'Confirmed'], ['pending', 'Waiting for confirmation'], ['unsubscribed', 'Unsubscribed']];
const STATUS = {
    active: ['Confirmed', 'bg-emerald-50 text-emerald-800 ring-emerald-200'],
    pending: ['Waiting', 'bg-amber-50 text-amber-900 ring-amber-200'],
    unsubscribed: ['Unsubscribed', 'bg-gray-100 text-gray-700 ring-gray-200'],
};
const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

export default function AdminNewsletter({ subscribers, filters = {}, counts = {}, issues = [] }) {
    const { t, language } = useTranslation();
    const date = (value) => (value ? new Intl.DateTimeFormat(localeFor(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—');
    const [search, setSearch] = useState(filters.search || '');
    const [removing, setRemoving] = useState(null);
    const [confirmSend, setConfirmSend] = useState(false);
    const [busy, setBusy] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({ subject: '', body: '' });

    const visit = (changes) => router.get(route('admin.newsletter'), { ...filters, ...changes }, { preserveScroll: true, preserveState: true, replace: true });
    useEffect(() => {
        if (search === (filters.search || '')) return undefined;
        const timer = setTimeout(() => visit({ search: search || undefined, page: undefined }), 350);
        return () => clearTimeout(timer);
    }, [search]);

    const send = () => {
        post(route('admin.newsletter.send'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onFinish: () => setConfirmSend(false),
        });
    };

    const remove = () => {
        setBusy(true);
        router.delete(route('admin.newsletter.destroy', removing.id), { preserveScroll: true, onFinish: () => { setBusy(false); setRemoving(null); } });
    };

    const ready = data.subject.trim() !== '' && data.body.trim().length >= 10 && (counts.active ?? 0) > 0;

    return (
        <AuthenticatedLayout header="Newsletter">
            <Head title={t('Newsletter')} />

            <div className="grid gap-4 sm:grid-cols-3">
                {[
                    ['Confirmed subscribers', counts.active ?? 0, 'text-emerald-700', MailCheck],
                    ['Waiting for confirmation', counts.pending ?? 0, 'text-amber-700', Users],
                    ['Unsubscribed', counts.unsubscribed ?? 0, 'text-gray-600', Users],
                ].map(([label, value, tone, Icon]) => (
                    <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <p className="flex items-center gap-2 text-sm text-gray-600"><Icon size={16} className={tone} aria-hidden="true" />{t(label)}</p>
                        <p className={`mt-2 font-[Sora] text-3xl font-semibold ${tone}`}>{value}</p>
                    </div>
                ))}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" aria-labelledby="compose-title">
                    <h2 id="compose-title" className="font-[Sora] text-lg font-semibold text-gray-900">{t('Write a newsletter')}</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        {t('It goes to the :count confirmed subscribers, each with an unsubscribe link.', { count: counts.active ?? 0 })}
                    </p>

                    <label htmlFor="newsletter-subject" className="mb-1.5 mt-5 block text-[13px] font-medium text-gray-700">{t('Subject')}</label>
                    <input
                        id="newsletter-subject"
                        value={data.subject}
                        maxLength={150}
                        onChange={(e) => setData('subject', e.target.value)}
                        placeholder={t('New offices available in Kigali')}
                        className="w-full rounded-xl border-gray-300 px-4 py-2.5 text-sm focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10"
                    />
                    {errors.subject && <p className="mt-1 text-xs font-medium text-red-600">{t(errors.subject)}</p>}

                    <div className="mb-1.5 mt-4 flex items-center justify-between">
                        <label htmlFor="newsletter-body" className="text-[13px] font-medium text-gray-700">{t('Message')}</label>
                        <span className="text-xs text-gray-500" aria-hidden="true">{data.body.length}/10000</span>
                    </div>
                    <textarea
                        id="newsletter-body"
                        rows={10}
                        maxLength={10000}
                        value={data.body}
                        onChange={(e) => setData('body', e.target.value)}
                        placeholder={t('Write your news here. Leave an empty line between paragraphs.')}
                        className="w-full resize-y rounded-xl border-gray-300 px-4 py-2.5 text-sm focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10"
                        aria-describedby="newsletter-body-help"
                    />
                    <p id="newsletter-body-help" className="mt-1 text-xs text-gray-500">{t('Leave an empty line between paragraphs.')}</p>
                    {errors.body && <p className="mt-1 text-xs font-medium text-red-600">{t(errors.body)}</p>}

                    <button
                        type="button"
                        disabled={!ready || processing}
                        onClick={() => setConfirmSend(true)}
                        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0E3B2E] px-5 text-sm font-semibold text-white hover:bg-[#124B3A] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                        {t('Send newsletter')}
                    </button>
                    {(counts.active ?? 0) === 0 && <p className="mt-2 text-xs text-amber-800">{t('Nobody has confirmed a subscription yet.')}</p>}

                    {issues.length > 0 && (
                        <div className="mt-8 border-t border-gray-100 pt-5">
                            <h3 className="text-sm font-semibold text-gray-900">{t('Sent newsletters')}</h3>
                            <ul className="mt-3 divide-y divide-gray-100">
                                {issues.map((issue) => (
                                    <li key={issue.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                        <span className="min-w-0 truncate font-medium text-gray-800">{issue.subject}</span>
                                        <span className="shrink-0 text-xs text-gray-500">{date(issue.created_at)} · {t(':count recipients', { count: issue.recipients })}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" aria-labelledby="subscribers-title">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 id="subscribers-title" className="font-[Sora] text-lg font-semibold text-gray-900">{t('Subscribers')}</h2>
                        <a href={route('admin.newsletter.export')} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                            <Download size={15} aria-hidden="true" />
                            {t('Export CSV')}
                        </a>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label={t('Filter subscribers')}>
                        {TABS.map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                role="tab"
                                aria-selected={(filters.status || 'all') === value}
                                onClick={() => visit({ status: value, page: undefined })}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${(filters.status || 'all') === value ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                {t(label)} ({counts[value] ?? 0})
                            </button>
                        ))}
                    </div>

                    <div className="relative mt-4">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('Search by email')}
                            aria-label={t('Search by email')}
                            className="w-full rounded-xl border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10"
                        />
                    </div>

                    {subscribers.data.length === 0 ? (
                        <p className="mt-6 rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-600">{t('No subscribers yet. They appear here when visitors subscribe on the home page.')}</p>
                    ) : (
                        <ul className="mt-4 divide-y divide-gray-100">
                            {subscribers.data.map((subscriber) => {
                                const [label, tone] = STATUS[subscriber.status] ?? STATUS.pending;
                                return (
                                    <li key={subscriber.id} className="flex items-center gap-3 py-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-gray-900">{subscriber.email}</p>
                                            <p className="text-xs text-gray-500">{date(subscriber.created_at)} · {subscriber.locale.toUpperCase()}</p>
                                        </div>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>{t(label)}</span>
                                        <button
                                            type="button"
                                            onClick={() => setRemoving(subscriber)}
                                            className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-700"
                                            aria-label={t('Remove :email', { email: subscriber.email })}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {subscribers.last_page > 1 && (
                        <nav className="mt-4 flex flex-wrap gap-1.5" aria-label={t('Pages')}>
                            {subscribers.links.map((link, index) =>
                                link.url ? (
                                    <Link key={index} href={link.url} preserveScroll preserveState className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${link.active ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                                ) : null,
                            )}
                        </nav>
                    )}
                </section>
            </div>

            <ConfirmActionModal
                open={confirmSend}
                title={t('Send this newsletter?')}
                message={t('":subject" will be emailed to :count confirmed subscribers. This cannot be undone.', { subject: data.subject, count: counts.active ?? 0 })}
                confirmLabel={t('Yes, send it')}
                processing={processing}
                onConfirm={send}
                onCancel={() => !processing && setConfirmSend(false)}
            />
            <ConfirmActionModal
                open={!!removing}
                title={t('Remove this subscriber?')}
                message={removing ? t(':email will be removed from the list and will not receive newsletters.', { email: removing.email }) : ''}
                confirmLabel={t('Yes, remove')}
                tone="danger"
                processing={busy}
                onConfirm={remove}
                onCancel={() => !busy && setRemoving(null)}
            />
        </AuthenticatedLayout>
    );
}
