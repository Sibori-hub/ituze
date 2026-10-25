import { useTranslation } from '@/localization';
import { AlertCircle, Camera, CheckCircle2, FileText, IdCard, Trash2, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const MAX_TENANT_FILE_BYTES = 5 * 1024 * 1024; // matches max:5120 on the server

/** Resizes a large photo as JPEG; returns the original if the browser cannot read it. */
async function shrinkPhoto(file, maxSide) {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (!blob) return file;

        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
        return file;
    }
}

function usePreview(file) {
    const [preview, setPreview] = useState(null);
    useEffect(() => {
        if (!file || !(file.type || '').startsWith('image/')) {
            setPreview(null);
            return undefined;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [file]);

    return preview;
}

/** Checks the type and size and shrinks large photos; calls onChange with the ready file. */
function usePicker({ allowPdf, maxSide, onChange }) {
    const { t } = useTranslation();
    const [localError, setLocalError] = useState('');
    const pick = async (picked) => {
        if (!picked) return;
        const isPdf = picked.type === 'application/pdf' || /\.pdf$/i.test(picked.name);
        const isImage = picked.type ? picked.type.startsWith('image/') : /\.(jpe?g|png|webp)$/i.test(picked.name);
        if (!isImage && !(allowPdf && isPdf)) {
            setLocalError(allowPdf ? t('Please choose a photo (JPG, PNG or WEBP) or a PDF.') : t('Please choose a photo (JPG, PNG or WEBP).'));
            return;
        }
        const ready = isImage && picked.size > MAX_TENANT_FILE_BYTES / 2 ? await shrinkPhoto(picked, maxSide) : picked;
        if (ready.size > MAX_TENANT_FILE_BYTES) {
            setLocalError(t('This file is :size MB. The maximum is 5 MB.', { size: (ready.size / 1048576).toFixed(1) }));
            return;
        }
        setLocalError('');
        onChange(ready);
    };

    return { pick, localError };
}

/** Round profile photo picker; on phones it can open the camera. */
export function TenantPhotoPicker({ id, file, onChange, error }) {
    const { t } = useTranslation();
    const input = useRef(null);
    const preview = usePreview(file);
    const { pick, localError } = usePicker({ allowPdf: false, maxSide: 800, onChange });
    const message = localError || (error ? t(error) : '');

    return (
        <div className="flex flex-col items-center text-center">
            <button
                type="button"
                onClick={() => input.current?.click()}
                aria-describedby={message ? `${id}-error` : `${id}-help`}
                className={`group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/25 ${
                    message ? 'border-red-300 bg-red-50' : file ? 'border-transparent ring-4 ring-green-100' : 'border-gray-300 bg-gray-50 hover:border-[#0E3B2E] hover:bg-[#0E3B2E]/[0.04]'
                }`}
            >
                {preview ? (
                    <img src={preview} alt={t('Profile photo preview')} className="h-full w-full object-cover" />
                ) : (
                    <span className="flex flex-col items-center gap-1 text-gray-500 group-hover:text-[#0E3B2E]">
                        <Camera size={26} aria-hidden="true" />
                        <span className="text-[11px] font-semibold">{t('Add photo')}</span>
                    </span>
                )}
                {preview && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">{t('Change')}</span>
                )}
                <span className="sr-only">{file ? t('Change profile photo') : t('Add profile photo')}</span>
            </button>
            <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden"
                onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ''; }} aria-label={t('Profile photo')} />
            <p className="mt-2 text-sm font-semibold text-gray-900">{t('Profile photo')}</p>
            <p id={`${id}-help`} className="text-xs text-gray-500">{t('A clear photo of the face')}</p>
            {message && <p id={`${id}-error`} role="alert" className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={12} aria-hidden="true" />{message}</p>}
        </div>
    );
}

/** Drop zone for a photo or scan of the National ID or passport. */
export function TenantDocumentPicker({ id, label, file, onChange, error }) {
    const { t } = useTranslation();
    const input = useRef(null);
    const preview = usePreview(file);
    const [dragging, setDragging] = useState(false);
    const { pick, localError } = usePicker({ allowPdf: true, maxSide: 2000, onChange });
    const message = localError || (error ? t(error) : '');

    return (
        <div>
            <p id={`${id}-label`} className="mb-1.5 text-sm font-medium text-gray-800">{label}</p>
            <div
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files?.[0]); }}
                className={`flex items-center gap-4 rounded-2xl border-2 border-dashed p-3 transition ${
                    message ? 'border-red-300 bg-red-50/40' : dragging ? 'border-[#0E3B2E] bg-[#0E3B2E]/[0.04]' : file ? 'border-green-300 bg-green-50/40' : 'border-gray-300 bg-gray-50/60'
                }`}
            >
                <span className="flex h-16 w-24 flex-none items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
                    {preview
                        ? <img src={preview} alt={t(':label preview', { label })} className="h-full w-full object-cover" />
                        : file ? <FileText size={24} className="text-[#0E3B2E]" aria-hidden="true" /> : <IdCard size={24} className="text-gray-400" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-xs text-gray-600">
                        {file && <CheckCircle2 size={13} className="flex-none text-green-600" aria-hidden="true" />}
                        <span className="truncate">{file ? file.name : t('JPG, PNG, WEBP or PDF, up to 5 MB')}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => input.current?.click()} aria-describedby={`${id}-label${message ? ` ${id}-error` : ''}`}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#124B3A] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/25">
                            <UploadCloud size={14} aria-hidden="true" />{file ? t('Change file') : t('Upload')}
                        </button>
                        {file && (
                            <button type="button" onClick={() => onChange(null)}
                                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/15">
                                <Trash2 size={14} aria-hidden="true" />{t('Remove')}
                            </button>
                        )}
                    </div>
                </div>
                <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                    onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ''; }} aria-labelledby={`${id}-label`} />
            </div>
            {message && <p id={`${id}-error`} role="alert" className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={12} aria-hidden="true" />{message}</p>}
        </div>
    );
}
