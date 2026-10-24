import { useTranslation } from '@/localization';
import { usePage } from '@inertiajs/react';
import { FileText, Headset, Loader2, MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const OPEN_POLL_MS = 4000;
const CLOSED_POLL_MS = 30000;

/** "14:05" today, "24 Oct 14:05" before. */
export function chatTime(value, locale) {
    const date = new Date(value);
    const sameDay = date.toDateString() === new Date().toDateString();
    return new Intl.DateTimeFormat(locale, sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

/** One message bubble; `mine` sits on the right. */
export function ChatBubble({ message, mine, locale }) {
    const { t } = useTranslation();
    return (
        <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? 'rounded-br-md bg-[#0E3B2E] text-white' : 'rounded-bl-md bg-white text-gray-900 ring-1 ring-gray-200'}`}>
                {message.attachment && (
                    message.attachment.image ? (
                        <a href={message.attachment.url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                            <img src={message.attachment.url} alt={message.attachment.name} className="max-h-48 rounded-lg object-cover" loading="lazy" />
                        </a>
                    ) : (
                        <a href={message.attachment.url} target="_blank" rel="noopener noreferrer" className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold underline-offset-2 hover:underline ${mine ? 'bg-white/15' : 'bg-gray-100'}`}>
                            <FileText size={14} aria-hidden="true" /> <span className="truncate">{message.attachment.name}</span>
                        </a>
                    )
                )}
                {message.body && <p className="whitespace-pre-line break-words">{message.body}</p>}
                <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-white/70' : 'text-gray-500'}`}>
                    {chatTime(message.created_at, locale)}
                    {mine && <span className="ml-1">{message.read ? t('· Seen') : ''}</span>}
                </p>
            </div>
        </li>
    );
}

/**
 * The "Chat with ITUZE" button and window for owners, managers and
 * advertisers. Checks for replies every few seconds while open.
 */
export default function ChatWidget() {
    const { t, language } = useTranslation();
    const locale = { en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' }[language] || 'en-RW';
    const page = usePage();
    const [open, setOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('chat') === '1');
    const [messages, setMessages] = useState([]);
    const [unread, setUnread] = useState(page.props.auth?.chatUnread ?? 0);
    const [body, setBody] = useState('');
    const [file, setFile] = useState(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [loaded, setLoaded] = useState(false);
    const lastId = useRef(0);
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const fileRef = useRef(null);

    useEffect(() => setUnread(page.props.auth?.chatUnread ?? 0), [page.props.auth?.chatUnread]);

    const merge = (incoming) => {
        if (!incoming.length) return;
        setMessages((current) => {
            const known = new Set(current.map((message) => message.id));
            return [...current, ...incoming.filter((message) => !known.has(message.id))];
        });
        lastId.current = Math.max(lastId.current, ...incoming.map((message) => message.id));
    };

    const fetchMessages = useCallback(async (markRead) => {
        try {
            const { data } = await window.axios.get(route('chat.index'), { params: { after: lastId.current, read: markRead ? 1 : 0 } });
            merge(data.messages || []);
            setUnread(markRead ? 0 : data.unread ?? 0);
            setLoaded(true);
        } catch {
            // Offline for a moment: the next check tries again.
        }
    }, []);

    useEffect(() => {
        fetchMessages(open);
        const timer = window.setInterval(() => fetchMessages(open), open ? OPEN_POLL_MS : CLOSED_POLL_MS);
        return () => window.clearInterval(timer);
    }, [open, fetchMessages]);

    useEffect(() => {
        if (open) {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
        }
    }, [messages.length, open]);

    useEffect(() => {
        if (!open) return undefined;
        inputRef.current?.focus();
        const onKey = (event) => event.key === 'Escape' && setOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const send = async (event) => {
        event?.preventDefault();
        if (sending || (!body.trim() && !file)) return;
        setSending(true);
        setError('');
        const form = new FormData();
        if (body.trim()) form.append('body', body.trim());
        if (file) form.append('file', file);
        try {
            const { data } = await window.axios.post(route('chat.store'), form);
            merge([data.message]);
            setBody('');
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
        } catch (err) {
            const errors = err.response?.data?.errors;
            setError(errors ? Object.values(errors)[0][0] : t('The message could not be sent. Check your internet and try again.'));
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    return (
        <>
            {open && (
                <section
                    role="dialog"
                    aria-modal="false"
                    aria-labelledby="chat-title"
                    className="fixed inset-x-3 bottom-20 z-50 flex h-[min(70vh,560px)] flex-col overflow-hidden rounded-2xl bg-gray-50 shadow-2xl ring-1 ring-black/10 sm:inset-x-auto sm:right-6 sm:w-[380px]"
                >
                    <header className="flex items-center gap-3 bg-[#0E3B2E] px-4 py-3 text-white">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15" aria-hidden="true"><Headset size={18} /></span>
                        <div className="min-w-0 flex-1">
                            <h2 id="chat-title" className="font-semibold">{t('ITUZE support')}</h2>
                            <p className="text-xs text-white/75">{t('We reply as soon as we can, by chat, SMS or email.')}</p>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={t('Close the chat')}>
                            <X size={18} />
                        </button>
                    </header>

                    <ol ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite" aria-label={t('Messages')}>
                        {!loaded && <li className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" aria-hidden="true" /></li>}
                        {loaded && messages.length === 0 && (
                            <li className="mx-auto mt-6 max-w-[260px] rounded-2xl bg-white p-4 text-center text-sm text-gray-700 ring-1 ring-gray-200">
                                {t('Hello! Ask us anything about ITUZE: payments, houses, tenants or your account.')}
                            </li>
                        )}
                        {messages.map((message) => <ChatBubble key={message.id} message={message} mine={!message.from_support} locale={locale} />)}
                    </ol>

                    <form onSubmit={send} className="border-t border-gray-200 bg-white p-2.5">
                        {error && <p className="mb-1.5 px-1 text-xs font-medium text-red-600" role="alert">{t(error)}</p>}
                        {file && (
                            <p className="mb-1.5 flex items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs text-gray-700">
                                <Paperclip size={13} aria-hidden="true" /> <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="rounded p-0.5 hover:bg-gray-200" aria-label={t('Remove the file')}><X size={13} /></button>
                            </p>
                        )}
                        <div className="flex items-end gap-1.5">
                            <label className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 focus-within:ring-2 focus-within:ring-[#0E3B2E]/30" title={t('Attach a photo or PDF')}>
                                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} aria-label={t('Attach a photo or PDF')} />
                                <Paperclip size={18} aria-hidden="true" />
                            </label>
                            <textarea
                                ref={inputRef}
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) send(event);
                                }}
                                rows={1}
                                maxLength={4000}
                                placeholder={t('Write a message…')}
                                aria-label={t('Write a message…')}
                                className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border-gray-300 px-3 py-2 text-sm focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15"
                            />
                            <button type="submit" disabled={sending || (!body.trim() && !file)} className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#0E3B2E] text-white hover:bg-[#124B3A] disabled:opacity-40" aria-label={t('Send')}>
                                {sending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="fixed bottom-4 right-4 z-50 flex h-14 items-center gap-2 rounded-full bg-[#0E3B2E] pl-4 pr-5 font-semibold text-white shadow-xl shadow-black/20 transition hover:bg-[#124B3A] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/30 sm:right-6"
                aria-expanded={open}
                aria-label={unread > 0 ? t('Chat with ITUZE (:count new)', { count: unread }) : t('Chat with ITUZE')}
            >
                {open ? <X size={22} aria-hidden="true" /> : <MessageCircle size={22} aria-hidden="true" />}
                <span className="hidden text-sm sm:inline">{open ? t('Close') : t('Chat with us')}</span>
                {!open && unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold ring-2 ring-white" aria-hidden="true">{unread}</span>
                )}
            </button>
        </>
    );
}
