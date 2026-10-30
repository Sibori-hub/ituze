import useFloorLabel from '@/hooks/useFloorLabel';
import RoomDescriptionField from '@/Components/RoomDescriptionField';
import { useTranslation } from '@/localization';
import { isApartmentUnitType } from '@/utils/unitType';
import { router } from '@inertiajs/react';
import { AlertCircle, ImagePlus, Loader2, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_NEW_IMAGES = 10;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const STATUSES = ['available', 'occupied', 'maintenance', 'reserved', 'inactive'];

const inputClass = (invalid) => `mt-1.5 w-full rounded-xl border bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-gray-900 dark:text-slate-100 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 dark:border-slate-600 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;
const imageSource = (path) => (/^https?:\/\//i.test(path || '') ? path : `/storage/${path}`);
const isNumber = (value) => String(value).trim() !== '' && !Number.isNaN(Number(value));

/**
 * Add or edit a room. Fields are checked in the browser as you go; saving
 * happens in the background and keeps the page where it is.
 *
 * `propertyUnits` are the property's units: { id, unit_type_id, category, floor_number }.
 *
 * Floor mode (`floors` given): a unit is a plain space on a floor (number,
 * size, monthly rent, photos) with no category; what it is used for is typed
 * when it is rented. `floorNumber` fixes the floor.
 */
export default function RoomForm({ property, propertyUnits = [], room = null, initialUnitId = null, lockUnit = false, onSaved, onCancel, compact = false, floors = null, floorNumber = null }) {
    const { t } = useTranslation();
    const floorLabel = useFloorLabel();
    const isEdit = Boolean(room);
    const floorMode = Array.isArray(floors);
    const floorLocked = floorMode && (isEdit || (floorNumber !== null && floorNumber !== undefined));
    // Added from a unit's own "Add room": the room stays in that unit.
    const unitLocked = lockUnit && !isEdit && Boolean(initialUnitId);

    const startUnit = propertyUnits.find(u => String(u.id) === String(room?.property_unit_id ?? initialUnitId))
        || (!isEdit && propertyUnits.length === 1 ? propertyUnits[0] : null);

    const [data, setFormData] = useState(() => ({
        property_unit_id: startUnit ? String(startUnit.id) : '',
        floor_number: String(room?.floor_number ?? floorNumber ?? (floors?.includes(0) ? 0 : floors?.[0] ?? 0)),
        unit_number: room?.unit_number || '',
        rent_amount: room?.rent_amount ? String(Number(room.rent_amount)) : '',
        rent_frequency: room?.rent_frequency || 'monthly',
        size_sqm: room?.size_sqm != null && room?.size_sqm !== '' ? String(Number(room.size_sqm)) : '',
        bedrooms: room?.bedrooms ?? '',
        bathrooms: room?.bathrooms != null ? String(Number(room.bathrooms)) : '',
        description: room?.description || '',
        status: room?.status || 'available',
    }));
    const [touched, setTouched] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(null);
    const summaryRef = useRef(null);

    const setData = (field, value) => {
        setFormData(current => ({ ...current, [field]: value }));
        setServerErrors(current => {
            if (!current[field]) return current;
            const { [field]: _removed, ...rest } = current;
            return rest;
        });
    };
    const touch = (field) => setTouched(current => ({ ...current, [field]: true }));

    const parent = propertyUnits.find(u => String(u.id) === String(data.property_unit_id));
    // Monthly rent only for plain units; old apartment rooms keep their extra fields.
    const isApartment = !floorMode && isApartmentUnitType({ name: parent?.category });
    const word = floorMode ? 'Unit' : 'Room';
    const unitLabel = (u) => `${u.category} · ${floorLabel(u.floor_number)}`;

    // Photos.
    const photoInput = useRef(null);
    const [newImages, setNewImages] = useState([]);
    const [removedImageIds, setRemovedImageIds] = useState([]);
    const [imageNotice, setImageNotice] = useState('');
    const savedImages = room?.images || [];
    useEffect(() => () => newImages.forEach(image => URL.revokeObjectURL(image.url)), []);
    const addImages = (files) => {
        const rejected = [];
        const accepted = [];
        Array.from(files || []).forEach(file => {
            if (!IMAGE_TYPES.includes(file.type)) rejected.push(t(':file is not a JPG, PNG, GIF or WebP image.', { file: file.name }));
            else if (file.size > MAX_IMAGE_BYTES) rejected.push(t(':file is larger than 2 MB.', { file: file.name }));
            else accepted.push({ file, url: URL.createObjectURL(file) });
        });
        const room_left = MAX_NEW_IMAGES - newImages.length;
        if (accepted.length > room_left) {
            accepted.splice(room_left).forEach(image => URL.revokeObjectURL(image.url));
            rejected.push(t('You can add up to 10 photos at a time.'));
        }
        setImageNotice(rejected.join(' '));
        if (accepted.length) setNewImages(current => [...current, ...accepted]);
    };
    const removeNewImage = (index) => setNewImages(current => {
        URL.revokeObjectURL(current[index].url);
        return current.filter((_, i) => i !== index);
    });

    // Validation, mirroring the server rules.
    const clientErrors = useMemo(() => {
        const errors = {};
        if (!floorMode && !data.property_unit_id) errors.property_unit_id = t('Choose the unit this room belongs to.');
        if (!data.unit_number.trim()) errors.unit_number = floorMode ? t('Enter the unit number, for example 001.') : t('Enter the room number.');
        else if (data.unit_number.length > 50) errors.unit_number = t('Use at most 50 characters.');
        if (!isNumber(data.rent_amount) || Number(data.rent_amount) < 0) errors.rent_amount = t('Enter the rent in RWF.');
        if (data.size_sqm !== '' && (!isNumber(data.size_sqm) || Number(data.size_sqm) < 0)) errors.size_sqm = t('Enter the size in m², or leave it empty.');
        // Every unit is shown with at least one photo.
        const photosLeft = savedImages.filter(image => !removedImageIds.includes(image.id)).length + newImages.length;
        if (photosLeft === 0) errors.images = t('Add at least one photo of the unit.');
        if (isApartment) {
            if (!/^\d+$/.test(String(data.bedrooms)) || Number(data.bedrooms) > 50) errors.bedrooms = t('Enter the number of bedrooms (0 to 50).');
            if (!isNumber(data.bathrooms) || Number(data.bathrooms) < 0 || Number(data.bathrooms) > 30) errors.bathrooms = t('Enter the number of bathrooms (0 to 30).');
        }
        return errors;
    }, [data, isApartment, t, newImages, removedImageIds]);

    const errorFor = (field) => serverErrors[field] || ((touched[field] || submitted) ? clientErrors[field] : undefined);
    const fieldOrder = ['property_unit_id', 'unit_number', 'rent_amount', 'size_sqm', 'bedrooms', 'bathrooms', 'status', 'images', 'description'];
    const labels = {
        property_unit_id: t('Unit'), unit_number: t(`${word} number`), rent_amount: t('Rent'), size_sqm: t('Size (m²)'), images: t('Photos'),
        bedrooms: t('Bedrooms'), bathrooms: t('Bathrooms'), status: t('Status'), description: t('Description'),
    };
    const shown = fieldOrder.map(field => [field, errorFor(field)]).filter(([, message]) => message);
    const imageServerError = serverErrors.images || Object.entries(serverErrors).find(([k]) => k.startsWith('images.') || k.startsWith('delete_images'))?.[1];
    const otherServerError = serverErrors.unit_type_id || serverErrors.floor_number || serverErrors.rent_frequency;

    const focusField = (field) => {
        const el = document.getElementById(field === 'images' ? 'room-photos' : `room-${field}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus({ preventScroll: true });
    };

    const submit = (event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(clientErrors).length > 0) {
            requestAnimationFrame(() => summaryRef.current?.focus());
            return;
        }

        const form = new FormData();
        if (isEdit) form.append('_method', 'put');
        if (floorMode && !room?.property_unit_id) form.append('floor_number', data.floor_number);
        else form.append('property_unit_id', data.property_unit_id || room?.property_unit_id || '');
        form.append('unit_number', data.unit_number.trim());
        form.append('rent_amount', data.rent_amount);
        form.append('rent_frequency', isApartment ? data.rent_frequency : 'monthly');
        if (data.size_sqm !== '') form.append('size_sqm', data.size_sqm);
        if (isApartment) {
            form.append('bedrooms', data.bedrooms);
            form.append('bathrooms', data.bathrooms);
        }
        form.append('description', data.description);
        if (isEdit) form.append('status', data.status);
        newImages.forEach((image, index) => form.append(`images[${index}]`, image.file));
        removedImageIds.forEach((id, index) => form.append(`delete_images[${index}]`, id));

        setProcessing(true);
        setProgress(newImages.length ? 0 : null);
        router.post(isEdit ? route('properties.units.update', [property.id, room.id]) : route('properties.units.store', property.id), form, {
            preserveScroll: true,
            preserveState: true,
            onProgress: (p) => newImages.length && setProgress(Math.round(p?.percentage ?? 0)),
            onSuccess: () => onSaved?.(),
            onError: (errors) => {
                setServerErrors(errors);
                requestAnimationFrame(() => summaryRef.current?.focus());
            },
            onFinish: () => { setProcessing(false); setProgress(null); },
        });
    };

    const FieldError = ({ field }) => errorFor(field) ? (
        <p id={`room-${field}-error`} className="mt-1 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={14} className="flex-none" aria-hidden="true" />{errorFor(field)}
        </p>
    ) : null;
    const aria = (field) => ({
        id: `room-${field}`,
        'aria-invalid': errorFor(field) ? 'true' : undefined,
        'aria-describedby': errorFor(field) ? `room-${field}-error` : undefined,
    });

    return (
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className={`min-h-0 flex-1 space-y-5 ${compact ? 'overflow-y-auto px-6 py-5' : ''}`}>
                {(shown.length > 0 || otherServerError) && (
                    <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-900 dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/40">
                        <p className="flex items-center gap-2 font-semibold">
                            <AlertCircle size={18} aria-hidden="true" />
                            {shown.length <= 1 ? t('Please fix 1 field before saving.') : t('Please fix :count fields before saving.', { count: shown.length })}
                        </p>
                        <ul className="mt-2 space-y-1 pl-7">
                            {shown.map(([field, message]) => (
                                <li key={field}>
                                    <button type="button" onClick={() => focusField(field)} className="text-left underline underline-offset-2 hover:text-red-700 dark:hover:text-red-200">
                                        <span className="font-medium">{labels[field]}:</span> {message}
                                    </button>
                                </li>
                            ))}
                            {otherServerError && <li>{otherServerError}</li>}
                        </ul>
                    </div>
                )}

                {floorMode ? (
                <div>
                    <label htmlFor="room-floor_number" className="block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Floor')} <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
                    <select id="room-floor_number" value={data.floor_number} onChange={e => setData('floor_number', e.target.value)} disabled={floorLocked}
                        className={`${inputClass(false)} disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:text-gray-700 dark:disabled:text-slate-400`}>
                        {[...floors].sort((a, b) => a - b).map(floor => <option key={floor} value={floor}>{floorLabel(floor)}</option>)}
                    </select>
                </div>
                ) : (
                <div>
                    <label htmlFor="room-property_unit_id" className="block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Unit')} <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
                    <select {...aria('property_unit_id')} value={data.property_unit_id} onChange={e => { setData('property_unit_id', e.target.value); touch('property_unit_id'); }} disabled={unitLocked}
                        className={`${inputClass(errorFor('property_unit_id'))} disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:text-gray-700 dark:disabled:text-slate-400`}>
                        <option value="">{t('Choose the unit')}</option>
                        {[...propertyUnits].sort((a, b) => a.floor_number - b.floor_number).map(u => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
                    </select>
                    {unitLocked && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('This room is added to the unit you chose.')}</p>}
                    <FieldError field="property_unit_id" />
                </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label htmlFor="room-unit_number" className="block text-sm font-medium text-gray-800 dark:text-slate-100">{t(`${word} number`)} <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
                        <input {...aria('unit_number')} type="text" value={data.unit_number} maxLength={50} placeholder={floorMode ? t('e.g. 001') : t('e.g. 005')} autoComplete="off"
                            onChange={e => setData('unit_number', e.target.value)} onBlur={() => touch('unit_number')} className={inputClass(errorFor('unit_number'))} />
                        <FieldError field="unit_number" />
                    </div>
                    <div>
                        <label htmlFor="room-size_sqm" className="block text-sm font-medium text-gray-800 dark:text-slate-100">{t(floorMode ? 'Size (m²)' : 'Room size (m²)')}</label>
                        <input {...aria('size_sqm')} type="number" inputMode="decimal" min="0" step="0.01" value={data.size_sqm} placeholder={t('e.g., 60')}
                            onChange={e => setData('size_sqm', e.target.value)} onBlur={() => touch('size_sqm')} className={inputClass(errorFor('size_sqm'))} />
                        <FieldError field="size_sqm" />
                    </div>
                </div>

                <div className={`grid gap-4 ${isApartment ? 'sm:grid-cols-2' : ''}`}>
                    <div>
                        <label htmlFor="room-rent_amount" className="block text-sm font-medium text-gray-800 dark:text-slate-100">
                            {t(isApartment && data.rent_frequency === 'daily' ? 'Daily rate (RWF)' : 'Monthly Rent (RWF)')} <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
                        </label>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 mt-[3px] -translate-y-1/2 text-xs font-semibold text-gray-500 dark:text-slate-400" aria-hidden="true">RWF</span>
                            <input {...aria('rent_amount')} type="number" inputMode="numeric" min="0" step="100" value={data.rent_amount} placeholder={t('e.g., 150000')}
                                onChange={e => setData('rent_amount', e.target.value)} onBlur={() => touch('rent_amount')} className={`${inputClass(errorFor('rent_amount'))} pl-14`} />
                        </div>
                        <FieldError field="rent_amount" />
                    </div>
                    {isApartment && (
                        <div>
                            <label htmlFor="room-rent_frequency" className="block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Rent Frequency')}</label>
                            <select id="room-rent_frequency" value={data.rent_frequency} onChange={e => setData('rent_frequency', e.target.value)} className={inputClass(false)}>
                                <option value="monthly">{t('Monthly')}</option>
                                <option value="daily">{t('Daily')}</option>
                            </select>
                        </div>
                    )}
                </div>

                {isApartment && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="room-bedrooms" className="block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Bedrooms')} <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
                            <input {...aria('bedrooms')} type="number" inputMode="numeric" min="0" max="50" step="1" value={data.bedrooms}
                                onChange={e => setData('bedrooms', e.target.value)} onBlur={() => touch('bedrooms')} className={inputClass(errorFor('bedrooms'))} />
                            <FieldError field="bedrooms" />
                        </div>
                        <div>
                            <label htmlFor="room-bathrooms" className="block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Bathrooms')} <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
                            <input {...aria('bathrooms')} type="number" inputMode="decimal" min="0" max="30" step="0.5" value={data.bathrooms}
                                onChange={e => setData('bathrooms', e.target.value)} onBlur={() => touch('bathrooms')} className={inputClass(errorFor('bathrooms'))} />
                            <FieldError field="bathrooms" />
                        </div>
                    </div>
                )}

                {isEdit ? (
                    <div>
                        <label htmlFor="room-status" className="block text-sm font-medium text-gray-800 dark:text-slate-100">{t('Status')}</label>
                        <select {...aria('status')} value={data.status} onChange={e => setData('status', e.target.value)} className={inputClass(errorFor('status'))}>
                            {STATUSES.map(status => <option key={status} value={status}>{t(status.charAt(0).toUpperCase() + status.slice(1))}</option>)}
                        </select>
                        <FieldError field="status" />
                    </div>
                ) : (
                    <p className="rounded-xl bg-green-50 dark:bg-green-500/10 px-4 py-3 text-sm text-green-900 dark:text-green-300">{floorMode ? t('New units start as Available. What it is used for (office, salon, warehouse…) is chosen with each client who rents it.') : t('New rooms start as Available. You can change the status later by editing the room.')}</p>
                )}

                <div>
                    <p id="room-photos" tabIndex={-1} className="text-sm font-medium text-gray-800 dark:text-slate-100">{t(`${word} photos`)} <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></p>
                    <input ref={photoInput} type="file" multiple accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true"
                        onChange={e => { addImages(e.target.files); e.target.value = ''; }} />
                    <ul className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                        {savedImages.map(image => {
                            const removed = removedImageIds.includes(image.id);
                            return (
                                <li key={`saved-${image.id}`} className="relative aspect-[4/3] animate-fade-in overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800">
                                    <img src={imageSource(image.image_path)} alt="" className={`h-full w-full object-cover transition-opacity ${removed ? 'opacity-30 grayscale' : ''}`} />
                                    <button type="button" onClick={() => setRemovedImageIds(ids => removed ? ids.filter(id => id !== image.id) : [...ids, image.id])}
                                        className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-white/95 dark:bg-slate-900/95 px-2 py-1 text-xs font-semibold text-gray-800 dark:text-slate-100 shadow hover:bg-white dark:hover:bg-slate-800"
                                        aria-label={removed ? t('Keep this photo') : t('Remove this photo')}>
                                        {removed ? <><Undo2 size={12} aria-hidden="true" />{t('Keep')}</> : <X size={13} aria-hidden="true" />}
                                    </button>
                                </li>
                            );
                        })}
                        {newImages.map((image, index) => (
                            <li key={image.url} className="relative aspect-[4/3] animate-fade-in overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800">
                                <img src={image.url} alt="" className="h-full w-full object-cover" />
                                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#0E3B2E] px-2 py-0.5 text-[11px] font-semibold text-white">{t('New')}</span>
                                <button type="button" onClick={() => removeNewImage(index)} className="absolute right-1.5 top-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 p-1 text-gray-800 dark:text-slate-100 shadow hover:bg-white dark:hover:bg-slate-800" aria-label={t('Remove :file', { file: image.file.name })}>
                                    <X size={13} aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                        <li className="aspect-[4/3]">
                            <button type="button" onClick={() => photoInput.current?.click()}
                                className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/60 text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 transition-colors hover:border-[#0E3B2E]/60 hover:bg-[#0E3B2E]/[0.04]">
                                <ImagePlus size={20} aria-hidden="true" />
                                {savedImages.length + newImages.length > 0 ? t('Add more') : t('Add photos')}
                            </button>
                        </li>
                    </ul>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">{t('JPG, PNG, GIF or WebP · up to 2 MB each')}</p>
                    {(imageNotice || imageServerError || errorFor('images')) && <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">{imageNotice || imageServerError || errorFor('images')}</p>}
                </div>

                <RoomDescriptionField property={property} data={{ ...data, bedrooms: isApartment ? data.bedrooms : '', bathrooms: isApartment ? data.bathrooms : '' }} setData={setData} error={errorFor('description')} />
            </div>

            <div className={`flex gap-3 ${compact ? 'border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4' : 'mt-6 justify-end'}`}>
                <button type="button" onClick={onCancel} disabled={processing}
                    className={`rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60 ${compact ? 'flex-1' : ''}`}>
                    {t('Cancel')}
                </button>
                <button type="submit" disabled={processing}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#124B3A] disabled:opacity-60 ${compact ? 'flex-1' : ''}`}>
                    {processing && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                    {processing
                        ? (progress !== null && progress < 100 ? t('Uploading photos :percent%', { percent: progress }) : t('Saving...'))
                        : (isEdit ? t(`Save ${word.toLowerCase()}`) : t(`Add ${word.toLowerCase()}`))}
                </button>
            </div>
        </form>
    );
}
