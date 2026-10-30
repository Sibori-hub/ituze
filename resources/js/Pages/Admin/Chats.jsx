import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ChatBubble, chatTime } from '@/Components/ChatWidget';
import { useTranslation } from '@/localization';
import { Head } from '@inertiajs/react';
import { ArrowLeft, Building2, Loader2, Mail, MessageCircle, MessagesSquare, Paperclip, Phone, Search, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const LIST_POLL_MS = 8000;
const CHAT_POLL_MS = 4000;
const whatsappNumber = (phone) => `250${String(phone || '').replace(/\D/g, '').replace(/^(250)?0?/, '')}`;

export default function AdminChats({ conversations: initialList = [], selected: initialSelected = null }) {
    const { t, language } = useTranslation();
    const locale = { en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' }[language] || 'en-RW';
    const [list, setList] = useState(initialList);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(initialSelected);
    const [messages, setMessages] = useState([]);
    const [person, setPerson] = useState(null);
    const [loading, setLoading] = useState(false);
    const [body, setBody] = useState('');
    const [file, setFile] = useState(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const lastId = useRef(0);
    const listRef = useRef(null);
    const fileRef = useRef(null);
    const inputRef = useRef(null);

    const refreshList = useCallback(async () => {
        try {
            const { data } = await window.axios.get(route('admin.chats.list'), { params: { search } });
            setList(data.conversations || []);
        } catch {
            // Try again at the next check.
        }
    }, [search]);

    useEffect(() => {
        const first = window.setTimeout(refreshList, search ? 300 : 0);
        const timer = window.setInterval(refreshList, LIST_POLL_MS);
        return () => {
            window.clearTimeout(first);
            window.clearInterval(timer);
        };
    }, [refreshList]);

    const merge = (incoming) => {
        if (!incoming.length) return;
        setMessages((current) => {
            const known = new Set(current.map((message) => message.id));
            return [...current, ...incoming.filter((message) => !known.has(message.id))];
        });
        lastId.current = Math.max(lastId.current, ...incoming.map((message) => message.id));
    };

    const loadChat = useCallback(async (id) => {
        try {
            const { data } = await window.axios.get(route('admin.chats.show', id), { params: { after: lastId.current } });
            merge(data.messages || []);
            setPerson(data.person);
        } catch {
            // Try again at the next check.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selected) return undefined;
        lastId.current = 0;
        setMessages([]);
        setPerson(null);
        setLoading(true);
        setError('');
        loadChat(selected).then(refreshList);
        const timer = window.setInterval(() => loadChat(selected), CHAT_POLL_MS);
        return () => window.clearInterval(timer);
    }, [selected, loadChat]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [messages.length]);

    const send = async (event) => {
        event?.preventDefault();
        if (sending || !selected || (!body.trim() && !file)) return;
        setSending(true);
        setError('');
        const form = new FormData();
        if (body.trim()) form.append('body', body.trim());
        if (file) form.append('file', file);
        try {
            const { data } = await window.axios.post(route('admin.chats.store', selected), form);
            merge([data.message]);
            setBody('');
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
            refreshList();
        } catch (err) {
            const errors = err.response?.data?.errors;
            setError(errors ? Object.values(errors)[0][0] : t('The message could not be sent. Check your internet and try again.'));
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const current = list.find((item) => item.id === selected);

    return (
        <AuthenticatedLayout header="Chats">
            <Head title={t('Chats')} />

            <div className="grid h-[calc(100vh-11rem)] min-h-[520px] overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm lg:grid-cols-[300px_1fr_260px] md:grid-cols-[280px_1fr]">
                {/* Conversations */}
                <aside className={`flex min-h-0 flex-col border-r border-gray-100 dark:border-slate-800 ${selected ? 'hidden md:flex' : 'flex'}`} aria-label={t('Conversations')}>
                    <div className="border-b border-gray-100 dark:border-slate-800 p-3">
                        <div className="relative">
                            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search name or phone')} aria-label={t('Search name or phone')}
                                className="w-full rounded-xl border-gray-300 dark:border-slate-600 py-2 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15" />
                        </div>
                    </div>
                    {list.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-gray-600 dark:text-slate-300">
                            <MessagesSquare size={30} className="text-gray-300" aria-hidden="true" />
                            <p className="mt-2">{t('No chats yet. Owners start one with the "Chat with us" button in their dashboard.')}</p>
                        </div>
                    ) : (
                        <ul className="flex-1 overflow-y-auto">
                            {list.map((item) => (
                                <li key={item.id}>
                                    <button type="button" onClick={() => setSelected(item.id)} aria-current={item.id === selected ? 'true' : undefined}
                                        className={`flex w-full items-start gap-3 border-b border-gray-50 px-3 py-3 text-left transition ${item.id === selected ? 'bg-emerald-50/70 dark:bg-emerald-500/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#0E3B2E]/10 dark:bg-emerald-400/15 text-sm font-bold text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true">{item.name.charAt(0).toUpperCase()}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-baseline justify-between gap-2">
                                                <span className={`truncate text-sm ${item.unread ? 'font-bold text-gray-900 dark:text-slate-100' : 'font-semibold text-gray-800 dark:text-slate-100'}`}>{item.name}</span>
                                                <span className="flex-none text-[11px] text-gray-500 dark:text-slate-400">{item.last_message_at ? chatTime(item.last_message_at, locale) : ''}</span>
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span className={`min-w-0 flex-1 truncate text-xs ${item.unread ? 'font-semibold text-gray-800 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}>
                                                    {item.last_from_support ? `${t('You')}: ` : ''}{item.last}
                                                </span>
                                                {item.unread > 0 && <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">{item.unread}</span>}
                                            </span>
                                            {item.role && <span className="text-[11px] text-gray-500 dark:text-slate-400">{t(item.role)}</span>}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                {/* Conversation */}
                <section className={`min-h-0 flex-col bg-gray-50 dark:bg-slate-800/60 ${selected ? 'flex' : 'hidden md:flex'}`} aria-label={t('Conversation')}>
                    {!selected ? (
                        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-gray-600 dark:text-slate-300">
                            <MessageCircle size={34} className="text-gray-300" aria-hidden="true" />
                            <p className="mt-2">{t('Choose a chat on the left to read and reply.')}</p>
                        </div>
                    ) : (
                        <>
                            <header className="flex items-center gap-3 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
                                <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 md:hidden" aria-label={t('Back to the chats')}><ArrowLeft size={18} /></button>
                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate font-semibold text-gray-900 dark:text-slate-100">{person?.name ?? current?.name}</h2>
                                    <p className="truncate text-xs text-gray-500 dark:text-slate-400">{person ? `${t(person.role)} · ${person.phone}` : ''}</p>
                                </div>
                                {person?.phone && (
                                    <>
                                        <a href={`tel:${person.phone}`} className="rounded-lg p-2 text-[#0E3B2E] dark:text-emerald-300 hover:bg-gray-100 dark:hover:bg-slate-800" aria-label={t('Call :name', { name: person.name })}><Phone size={17} /></a>
                                        <a href={`https://wa.me/${whatsappNumber(person.phone)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-[#128c4b] dark:text-emerald-300 hover:bg-gray-100 dark:hover:bg-slate-800" aria-label="WhatsApp"><MessageCircle size={17} /></a>
                                    </>
                                )}
                            </header>

                            <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4" aria-live="polite" aria-label={t('Messages')}>
                                {loading && <li className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400 dark:text-slate-500" aria-hidden="true" /></li>}
                                {messages.map((message) => <ChatBubble key={message.id} message={message} mine={message.from_support} locale={locale} />)}
                            </ol>

                            <form onSubmit={send} className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                                {error && <p className="mb-1.5 text-xs font-medium text-red-600 dark:text-red-400" role="alert">{t(error)}</p>}
                                {file && (
                                    <p className="mb-1.5 flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-gray-700 dark:text-slate-200">
                                        <Paperclip size={13} aria-hidden="true" /> <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                        <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-slate-700" aria-label={t('Remove the file')}><X size={13} /></button>
                                    </p>
                                )}
                                <div className="flex items-end gap-2">
                                    <label className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800" title={t('Attach a photo or PDF')}>
                                        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} aria-label={t('Attach a photo or PDF')} />
                                        <Paperclip size={18} aria-hidden="true" />
                                    </label>
                                    <textarea ref={inputRef} value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) send(event); }}
                                        rows={1} maxLength={4000} placeholder={t('Write a reply…')} aria-label={t('Write a reply…')}
                                        className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border-gray-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15" />
                                    <button type="submit" disabled={sending || (!body.trim() && !file)} className="flex h-10 items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-40">
                                        {sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />} {t('Send')}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </section>

                {/* Who is writing */}
                <aside className="hidden min-h-0 overflow-y-auto border-l border-gray-100 dark:border-slate-800 p-4 lg:block" aria-label={t('About this person')}>
                    {person ? (
                        <div className="space-y-4 text-sm">
                            <div>
                                <p className="font-[Sora] text-base font-semibold text-gray-900 dark:text-slate-100">{person.name}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">{t(person.role)} · {t(person.status)}</p>
                            </div>
                            <dl className="space-y-2.5">
                                <div className="flex items-center gap-2 text-gray-700 dark:text-slate-200"><Phone size={14} className="text-gray-400 dark:text-slate-500" aria-hidden="true" /><a href={`tel:${person.phone}`} className="hover:underline">{person.phone}</a></div>
                                {person.email && <div className="flex items-center gap-2 text-gray-700 dark:text-slate-200"><Mail size={14} className="flex-none text-gray-400 dark:text-slate-500" aria-hidden="true" /><a href={`mailto:${person.email}`} className="truncate hover:underline">{person.email}</a></div>}
                                {person.houses !== null && (
                                    <div className="flex items-center gap-2 text-gray-700 dark:text-slate-200">
                                        <Building2 size={14} className="text-gray-400 dark:text-slate-500" aria-hidden="true" />
                                        {person.paid_houses !== null ? t(':paid of :count properties paid', { paid: person.paid_houses, count: person.houses }) : t(':houses house(s)', { houses: person.houses })}
                                    </div>
                                )}
                            </dl>
                            {person.subscription && (
                                <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${person.subscription.blocked ? 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300' : person.subscription.in_grace ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'}`}>
                                    {person.subscription.paid_until
                                        ? t('Paid until :date', { date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(person.subscription.paid_until)) })
                                        : t('Not paid yet')}
                                    {person.subscription.blocked ? ` · ${t('Paused')}` : ''}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-slate-400">{t('Details about the person appear here.')}</p>
                    )}
                </aside>
            </div>
        </AuthenticatedLayout>
    );
}
