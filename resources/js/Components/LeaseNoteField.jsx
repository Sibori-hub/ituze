import axios from 'axios';
import { Loader2, Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from '@/localization';

export default function LeaseNoteField({ value, onChange, routeName, routeParams, payload, disabled = false }) {
    const { t } = useTranslation();
    const noteId = useId();
    const [generating, setGenerating] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');

    const generateNote = async () => {
        setGenerating(true);
        setMessage('');

        try {
            const { data } = await axios.post(route(routeName, routeParams), payload);
            if (!data?.note) {
                throw new Error(t('The note generator returned an empty response.'));
            }

            onChange(data.note);
            setMessage(data.source === 'template'
                ? t('AI is unavailable; a template note was created. Review and edit it before saving.')
                : t('Note generated. Review and edit it before saving.'));
            setMessageType(data.source === 'template' ? 'warning' : 'info');
        } catch (error) {
            const validationMessage = Object.values(error.response?.data?.errors || {}).flat()[0];
            setMessage(validationMessage || error.response?.data?.message || error.message || t('Could not generate a lease note. Please try again.'));
            setMessageType('error');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={noteId} className="text-sm font-medium text-gray-700">{t('Lease note (optional)')}</label>
                <button
                    type="button"
                    onClick={generateNote}
                    disabled={disabled || generating}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#0E3B2E]/20 px-3 py-1.5 text-xs font-semibold text-[#0E3B2E] hover:bg-[#0E3B2E]/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {generating ? <><Loader2 size={13} className="animate-spin" />{t('Generating note…')}</> : <><Sparkles size={13} />{t('Generate note with AI')}</>}
                </button>
            </div>
            <textarea
                id={noteId}
                value={value}
                onChange={event => onChange(event.target.value)}
                rows="3"
                maxLength={1000}
                className="mt-1.5 w-full rounded-xl border-gray-200"
                placeholder={t('Add context for this lease document, or generate a draft to edit.')}
            />
            <p className="mt-1 text-xs text-gray-500">{t('Names and identifying details are not sent to the AI service.')}</p>
            {message && (
                <p role={messageType === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs ${messageType === 'error' ? 'text-red-600' : messageType === 'warning' ? 'text-amber-700' : 'text-gray-600'}`}>
                    {message}
                </p>
            )}
        </div>
    );
}
