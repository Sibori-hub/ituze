import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmActionModal from '@/Components/ConfirmActionModal';
import { useTranslation } from '@/localization';
import { Head, Link, router } from '@inertiajs/react';
import { CheckCircle2, Inbox, Mail, MessageCircle, Phone, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const TABS = [['new', 'New'], ['answered', 'Answered'], ['all', 'All']];
const TOPIC_TONES = {
    rent: 'bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/30',
    list: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30',
    partnership: 'bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 ring-violet-200 dark:ring-violet-500/30',
    other: 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 ring-gray-200 dark:ring-slate-700',
};
const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
// 0788123456 → 250788123456 for WhatsApp links.
const whatsappNumber = (phone) => `250${String(phone).replace(/\D/g, '').replace(/^(250)?0?/, '')}`;

export default function AdminMessages({ messages, filters = {}, counts = {} }) {
    const { t, language } = useTranslation();
    const when = (value) => new Intl.DateTimeFormat(localeFor(language), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
    const [search, setSearch] = useState(filters.search || '');
    const [removing, setRemoving] = useState(null);
    const [busy, setBusy] = useState(null);

    const visit = (changes) => router.get(route('admin.messages'), { ...filters, ...changes }, { preserveScroll: true, preserveState: true, replace: true });
    useEffect(() => {
        if (search === (filters.search || '')) return undefined;
        const timer = setTimeout(() => visit({ search: search || undefined, page: undefined }), 350);
        return () => clearTimeout(timer);
    }, [search]);

    const setAnswered = (message, answered) => {
        setBusy(message.id);
        router.patch(route('admin.messages.update', message.id), { answered }, { preserveScroll: true, onFinish: () => setBusy(null) });
    };

    const remove = () => {
        setBusy(removing.id);
        router.delete(route('admin.messages.destroy', removing.id), {
            preserveScroll: true,
            onFinish: () => {
                setBusy(null);
                setRemoving(null);
            },
        });
    };

    const status = filters.status || 'new';

    return (
        <AuthenticatedLayout header="Messages">
            <Head title={t('Messages')} />

            <section className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6" aria-labelledby="messages-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 id="messages-title" className="font-[Sora] text-lg font-semibold text-gray-900 dark:text-slate-100">{t('Messages from the website')}</h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Sent with the Contact us form and the Inquiry buttons. Reply, then mark them as answered.')}</p>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('Filter messages')}>
                        {TABS.map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                role="tab"
                                aria-selected={status === value}
                                onClick={() => visit({ status: value, page: undefined })}
                                className={`min-h-9 rounded-full px-3.5 text-xs font-semibold ${status === value ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                            >
                                {t(label)} ({counts[value] ?? 0})
                            </button>
                        ))}
                    </div>
                    <div className="relative sm:w-72">
                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('Search name, phone or text')}
                            aria-label={t('Search name, phone or text')}
                            className="w-full rounded-xl border-gray-300 dark:border-slate-600 py-2.5 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10"
                        />
                    </div>
                </div>

                {messages.data.length === 0 ? (
                    <div className="mt-6 rounded-xl bg-gray-50 dark:bg-slate-800/60 px-6 py-10 text-center">
                        <Inbox size={32} className="mx-auto text-gray-400 dark:text-slate-500" aria-hidden="true" />
                        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-slate-200">
                            {status === 'new' && !filters.search ? t('No new messages. You are all caught up!') : t('No messages found.')}
                        </p>
                    </div>
                ) : (
                    <ul className="mt-5 space-y-3">
                        {messages.data.map((message) => {
                            const answered = Boolean(message.answered_at);
                            const greeting = t('Hello :name, this is ITUZE replying to your message.', { name: message.name });
                            return (
                                <li key={message.id} className={`rounded-2xl border p-4 sm:p-5 ${answered ? 'border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40' : 'border-orange-200 dark:border-orange-500/30 bg-white dark:bg-slate-900 shadow-sm'}`}>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {!answered && <span className="h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden="true" />}
                                        <h3 className="font-semibold text-gray-900 dark:text-slate-100">{message.name}</h3>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TOPIC_TONES[message.topic] ?? TOPIC_TONES.other}`}>{t(message.topic_label)}</span>
                                        {answered && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-500/30">
                                                <CheckCircle2 size={12} aria-hidden="true" /> {t('Answered')}
                                            </span>
                                        )}
                                        <span className="ml-auto text-xs text-gray-500 dark:text-slate-400">{when(message.created_at)}</span>
                                    </div>

                                    <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-gray-800 dark:text-slate-100">{message.message}</p>

                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <a href={`tel:${message.phone}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-3.5 text-sm font-semibold text-white hover:bg-[#124B3A]">
                                            <Phone size={15} aria-hidden="true" /> {message.phone}
                                        </a>
                                        <a
                                            href={`https://wa.me/${whatsappNumber(message.phone)}?text=${encodeURIComponent(greeting)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#e7f9ee] dark:bg-emerald-500/10 px-3.5 text-sm font-semibold text-[#0f6b37] dark:text-emerald-300 ring-1 ring-inset ring-[#25d366]/40 hover:bg-[#d4f4e0] dark:hover:bg-emerald-500/20"
                                        >
                                            <MessageCircle size={15} aria-hidden="true" /> WhatsApp
                                        </a>
                                        {message.email && (
                                            <a
                                                href={`mailto:${message.email}?subject=${encodeURIComponent(t('Your message to ITUZE'))}&body=${encodeURIComponent(greeting + '\n\n')}`}
                                                className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-xl border border-gray-300 dark:border-slate-600 px-3.5 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
                                            >
                                                <Mail size={15} className="shrink-0" aria-hidden="true" /> <span className="truncate">{message.email}</span>
                                            </a>
                                        )}

                                        <div className="ml-auto flex items-center gap-1">
                                            {answered ? (
                                                <button type="button" disabled={busy === message.id} onClick={() => setAnswered(message, false)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50">
                                                    <RotateCcw size={15} aria-hidden="true" /> {t('Mark as new')}
                                                </button>
                                            ) : (
                                                <button type="button" disabled={busy === message.id} onClick={() => setAnswered(message, true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                                    <CheckCircle2 size={15} aria-hidden="true" /> {t('Mark as answered')}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setRemoving(message)}
                                                className="rounded-xl p-2.5 text-gray-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-200"
                                                aria-label={t('Delete the message from :name', { name: message.name })}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {messages.last_page > 1 && (
                    <nav className="mt-5 flex flex-wrap gap-1.5" aria-label={t('Pages')}>
                        {messages.links.map((link, index) =>
                            link.url ? (
                                <Link key={index} href={link.url} preserveScroll preserveState className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${link.active ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                            ) : null,
                        )}
                    </nav>
                )}
            </section>

            <ConfirmActionModal
                open={!!removing}
                title={t('Delete this message?')}
                message={removing ? t('The message from :name will be deleted for good.', { name: removing.name }) : ''}
                confirmLabel={t('Yes, delete')}
                tone="danger"
                processing={busy === removing?.id}
                onConfirm={remove}
                onCancel={() => busy === null && setRemoving(null)}
            />
        </AuthenticatedLayout>
    );
}
