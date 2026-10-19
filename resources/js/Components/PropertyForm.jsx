import BuildingFloorsFields from '@/Components/BuildingFloorsFields';
import { useTranslation } from '@/localization';
import { Link, router } from '@inertiajs/react';
import {
    AlertCircle, ArrowUpDown, Building2, Bus, Car, CheckCircle2, Circle, Droplets, Dumbbell, Hospital,
    ImagePlus, Loader2, Route, School, ShieldCheck, ShoppingBasket, Sparkles, Undo2, UtensilsCrossed,
    Waves, Wifi, Wine, X, Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { checkDescriptionResponse, descriptionErrorMessage } from '@/lib/descriptionRequest';

export const AMENITIES = [
    { key: 'wifi', label: 'WiFi', icon: Wifi },
    { key: 'parking', label: 'Parking', icon: Car },
    { key: 'gym', label: 'Gym', icon: Dumbbell },
    { key: 'swimming_pool', label: 'Swimming Pool', icon: Waves },
    { key: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
    { key: 'bar', label: 'Bar', icon: Wine },
    { key: 'security', label: 'Security', icon: ShieldCheck },
    { key: 'generator', label: 'Generator', icon: Zap },
    { key: 'water_tank', label: 'Water Tank', icon: Droplets },
    { key: 'elevator', label: 'Elevator', icon: ArrowUpDown },
    { key: 'cleaning_service', label: 'Cleaners', icon: Sparkles },
];

export const PROXIMITY = [
    { key: 'near_tarmac', label: 'Near Tarmac Road', icon: Route },
    { key: 'near_school', label: 'Near School', icon: School },
    { key: 'near_hospital', label: 'Near Hospital', icon: Hospital },
    { key: 'near_market', label: 'Near Market', icon: ShoppingBasket },
    { key: 'near_public_transport', label: 'Near Public Transport', icon: Bus },
];

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const inputBase = 'mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400';
const inputClass = (invalid) => `${inputBase} ${invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;

const imageSource = (path) => (/^https?:\/\//i.test(path || '') ? path : `/storage/${path}`);

const toBooleans = (source, keys) => {
    const out = Object.fromEntries(keys.map(k => [k, false]));
    if (Array.isArray(source)) source.forEach(k => { if (k in out) out[k] = true; });
    else if (source && typeof source === 'object') keys.forEach(k => { out[k] = [true, 1, '1'].includes(source[k]); });
    return out;
};

const isWholeNumber = (value, min, max) => /^\d+$/.test(String(value).trim()) && Number(value) >= min && Number(value) <= max;

const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    || decodeURIComponent(document.cookie.match(/(^|;\s*)XSRF-TOKEN=([^;]+)/)?.[2] || '');

const fetchJson = (url) => fetch(url, { headers: { Accept: 'application/json' } }).then(res => (res.ok ? res.json() : []));

/**
 * Add or edit a property. Every field is checked in the browser as soon as the
 * user leaves it and again on save, so mistakes show without a page reload;
 * the server's answer appears in the same places.
 */
export default function PropertyForm({ mode = 'create', property = null, isAdmin = false, owners = [], selectedOwnerId = '' }) {
    const { t } = useTranslation();
    const isEdit = mode === 'edit';
    const askOwner = isAdmin && !isEdit;

    const [data, setFormData] = useState(() => ({
        owner_id: selectedOwnerId ? String(selectedOwnerId) : '',
        name: property?.name || '',
        address: property?.address || '',
        total_floors: String(property?.total_floors ?? 0),
        basement_floors: String(property?.basement_floors ?? 0),
        cell_id: property?.cell_id ? String(property.cell_id) : '',
        description: property?.description || '',
        amenities: toBooleans(property?.amenities, AMENITIES.map(a => a.key)),
        proximity: toBooleans(property?.proximity, PROXIMITY.map(p => p.key)),
    }));
    const setData = (field, value) => {
        setFormData(current => ({ ...current, [field]: value }));
        setServerErrors(current => {
            if (!current[field]) return current;
            const { [field]: _removed, ...rest } = current;
            return rest;
        });
    };

    const toggle = (group, key) => setFormData(current => ({ ...current, [group]: { ...current[group], [key]: !current[group][key] } }));

    const [touched, setTouched] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
    const summaryRef = useRef(null);

    // Location: Province → District → Sector → Cell.
    const [place, setPlace] = useState({
        province: property?.cell?.sector?.district?.province_id ? String(property.cell.sector.district.province_id) : '',
        district: property?.cell?.sector?.district_id ? String(property.cell.sector.district_id) : '',
        sector: property?.cell?.sector_id ? String(property.cell.sector_id) : '',
    });
    const [lists, setLists] = useState({ provinces: [], districts: [], sectors: [], cells: [] });

    useEffect(() => {
        fetchJson('/api/provinces').then(provinces => setLists(l => ({ ...l, provinces })));
        if (place.province) fetchJson(`/api/districts/${place.province}`).then(districts => setLists(l => ({ ...l, districts })));
        if (place.district) fetchJson(`/api/sectors/${place.district}`).then(sectors => setLists(l => ({ ...l, sectors })));
        if (place.sector) fetchJson(`/api/cells/${place.sector}`).then(cells => setLists(l => ({ ...l, cells })));
    }, []);

    const choosePlace = (level, value) => {
        if (level === 'province') {
            setPlace({ province: value, district: '', sector: '' });
            setLists(l => ({ ...l, districts: [], sectors: [], cells: [] }));
            if (value) fetchJson(`/api/districts/${value}`).then(districts => setLists(l => ({ ...l, districts })));
        } else if (level === 'district') {
            setPlace(p => ({ ...p, district: value, sector: '' }));
            setLists(l => ({ ...l, sectors: [], cells: [] }));
            if (value) fetchJson(`/api/sectors/${value}`).then(sectors => setLists(l => ({ ...l, sectors })));
        } else {
            setPlace(p => ({ ...p, sector: value }));
            setLists(l => ({ ...l, cells: [] }));
            if (value) fetchJson(`/api/cells/${value}`).then(cells => setLists(l => ({ ...l, cells })));
        }
        setData('cell_id', '');
    };

    // Photos: new files plus, when editing, the saved ones (which can be removed).
    const [newImages, setNewImages] = useState([]); // { file, url }
    const [removedImageIds, setRemovedImageIds] = useState([]);
    const [imageNotice, setImageNotice] = useState('');
    const [dragging, setDragging] = useState(false);
    const photoInputRef = useRef(null);
    const openPhotoPicker = () => photoInputRef.current?.click();
    const dropHandlers = {
        onDragOver: (e) => { e.preventDefault(); setDragging(true); },
        onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); },
        onDrop: (e) => { e.preventDefault(); setDragging(false); addImages(e.dataTransfer.files); },
    };
    const savedImages = property?.images || [];
    useEffect(() => () => newImages.forEach(image => URL.revokeObjectURL(image.url)), []);

    const addImages = (files) => {
        const rejected = [];
        const accepted = [];
        Array.from(files || []).forEach(file => {
            if (!IMAGE_TYPES.includes(file.type)) rejected.push(t(':file is not a JPG, PNG, GIF or WebP image.', { file: file.name }));
            else if (file.size > MAX_IMAGE_BYTES) rejected.push(t(':file is larger than 2 MB.', { file: file.name }));
            else accepted.push({ file, url: URL.createObjectURL(file) });
        });
        setImageNotice(rejected.join(' '));
        if (accepted.length) setNewImages(current => [...current, ...accepted]);
    };
    const removeNewImage = (index) => setNewImages(current => {
        URL.revokeObjectURL(current[index].url);
        return current.filter((_, i) => i !== index);
    });
    const photoCount = savedImages.filter(image => !removedImageIds.includes(image.id)).length + newImages.length;
    const firstSaved = savedImages.find(image => !removedImageIds.includes(image.id));
    const coverKey = firstSaved ? `saved-${firstSaved.id}` : newImages[0]?.url;

    // Validation, mirroring the server rules.
    const clientErrors = useMemo(() => {
        const errors = {};
        if (askOwner && !data.owner_id) errors.owner_id = t('Choose the owner of this property.');
        if (!data.name.trim()) errors.name = t('Enter the property name.');
        else if (data.name.length > 255) errors.name = t('Use at most 255 characters.');
        if (data.address.length > 255) errors.address = t('Use at most 255 characters.');
        if (!isWholeNumber(data.total_floors, 0, 200)) errors.total_floors = t('Enter a whole number from 0 to 200.');
        if (!isWholeNumber(data.basement_floors, 0, 20)) errors.basement_floors = t('Enter a whole number from 0 to 20.');
        if (!data.cell_id) errors.cell_id = t('Choose the province, district, sector and cell.');
        return errors;
    }, [data, askOwner, t]);

    const errorFor = (field) => serverErrors[field] || ((touched[field] || submitted) ? clientErrors[field] : undefined);
    const touch = (field) => setTouched(current => ({ ...current, [field]: true }));
    const shownErrors = Object.fromEntries(
        ['owner_id', 'name', 'address', 'total_floors', 'basement_floors', 'cell_id', 'description', 'images']
            .map(field => [field, field === 'images' ? (serverErrors.images || Object.entries(serverErrors).find(([k]) => k.startsWith('images.'))?.[1]) : errorFor(field)])
            .filter(([, message]) => message),
    );
    const fieldIds = { owner_id: 'pf-owner', name: 'pf-name', address: 'pf-address', total_floors: 'pf-floors', basement_floors: 'pf-floors', cell_id: 'pf-province', description: 'pf-description', images: 'pf-photos-button' };
    const fieldLabels = { owner_id: t('Property owner'), name: t('Property name'), address: t('Street address'), total_floors: t('Floors'), basement_floors: t('Basements'), cell_id: t('Location'), description: t('Description'), images: t('Photos') };

    const focusField = (field) => {
        const el = document.getElementById(fieldIds[field]);
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
        if (askOwner) form.append('owner_id', data.owner_id);
        form.append('name', data.name.trim());
        form.append('address', data.address.trim());
        form.append('total_floors', String(Number(data.total_floors)));
        form.append('basement_floors', String(Number(data.basement_floors)));
        form.append('cell_id', data.cell_id);
        form.append('description', data.description);
        AMENITIES.forEach(a => form.append(`amenities[${a.key}]`, data.amenities[a.key] ? '1' : '0'));
        PROXIMITY.forEach(p => form.append(`proximity[${p.key}]`, data.proximity[p.key] ? '1' : '0'));
        newImages.forEach((image, index) => form.append(`images[${index}]`, image.file));
        removedImageIds.forEach((id, index) => form.append(`delete_images[${index}]`, id));

        setProcessing(true);
        setUploadProgress(newImages.length ? 0 : null);
        router.post(isEdit ? route('properties.update', property.id) : route('properties.store'), form, {
            preserveScroll: true,
            preserveState: true,
            onError: (errors) => {
                setServerErrors(errors);
                requestAnimationFrame(() => summaryRef.current?.focus());
            },
            onProgress: (progress) => newImages.length && setUploadProgress(Math.round(progress?.percentage ?? 0)),
            onFinish: () => { setProcessing(false); setUploadProgress(null); },
        });
    };

    // AI description.
    const [ai, setAi] = useState({ busy: false, message: '', tone: 'info' });
    const generateDescription = async () => {
        if (!data.name.trim()) {
            touch('name');
            setAi({ busy: false, message: t('Enter the property name first, so the description can mention it.'), tone: 'warning' });
            focusField('name');
            return;
        }
        setAi({ busy: true, message: '', tone: 'info' });
        const name = (list, id) => list.find(item => String(item.id) === String(id))?.name || '';
        try {
            const token = getCsrfToken();
            const res = await fetch('/api/ai/generate-property-description', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': token, 'X-XSRF-TOKEN': token },
                body: JSON.stringify({
                    name: data.name,
                    address: data.address,
                    total_floors: data.total_floors,
                    basement_floors: data.basement_floors,
                    cell_id: data.cell_id || null,
                    province_name: name(lists.provinces, place.province) || property?.cell?.sector?.district?.province?.name || '',
                    district_name: name(lists.districts, place.district) || property?.cell?.sector?.district?.name || '',
                    sector_name: name(lists.sectors, place.sector) || property?.cell?.sector?.name || '',
                    cell_name: name(lists.cells, data.cell_id) || property?.cell?.name || '',
                    amenities: data.amenities,
                    proximity: data.proximity,
                }),
            });
            checkDescriptionResponse(res);
            const json = await res.json();
            if (!json?.description) throw new Error('empty');
            setData('description', json.description);
            setAi({ busy: false, message: t('Description written. Read it and change anything you like.'), tone: 'info' });
        } catch (error) {
            setAi({ busy: false, message: descriptionErrorMessage(error, t), tone: 'warning' });
        }
    };

    const selectedAmenities = AMENITIES.filter(a => data.amenities[a.key]).length + PROXIMITY.filter(p => data.proximity[p.key]).length;
    const steps = [
        { id: 'pf-section-basics', label: t('Basics'), done: !clientErrors.name && !clientErrors.owner_id && !clientErrors.address },
        { id: 'pf-section-location', label: t('Location'), done: !clientErrors.cell_id },
        { id: 'pf-section-building', label: t('Building'), done: !clientErrors.total_floors && !clientErrors.basement_floors },
        { id: 'pf-section-photos', label: t('Photos'), done: photoCount > 0, optional: true },
        { id: 'pf-section-amenities', label: t('Amenities & nearby'), done: selectedAmenities > 0, optional: true },
        { id: 'pf-section-description', label: t('Description'), done: data.description.trim() !== '', optional: true },
    ];
    const errorCount = Object.keys(shownErrors).length;

    return (
        <form onSubmit={submit} noValidate className="mx-auto grid max-w-6xl gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_260px] lg:pb-0">
            <div className="space-y-5">
                {errorCount > 0 && (
                    <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500/40">
                        <p className="flex items-center gap-2 font-semibold">
                            <AlertCircle size={18} aria-hidden="true" />
                            {errorCount === 1 ? t('Please fix 1 field before saving.') : t('Please fix :count fields before saving.', { count: errorCount })}
                        </p>
                        <ul className="mt-2 space-y-1 pl-7">
                            {Object.entries(shownErrors).map(([field, message]) => (
                                <li key={field}>
                                    <button type="button" onClick={() => focusField(field)} className="text-left underline underline-offset-2 hover:text-red-700">
                                        <span className="font-medium">{fieldLabels[field]}:</span> {message}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <Section id="pf-section-basics" number={1} title={t('Basics')} description={t('Who owns the building and what it is called.')}>
                    {askOwner && (
                        <Field id="pf-owner" label={t('Property owner')} required error={errorFor('owner_id')}
                            hint={<>{owners.length === 0 ? t('No owners created by an administrator yet.') : t('Only owners created by an administrator are listed.')}{' '}<Link href={route('admin.users.create')} className="font-semibold text-[#0E3B2E] underline underline-offset-2">{t('Create an owner')}</Link></>}>
                            {(props) => (
                                <select {...props} value={data.owner_id} onChange={e => { setData('owner_id', e.target.value); touch('owner_id'); }} onBlur={() => touch('owner_id')} className={inputClass(props['aria-invalid'])}>
                                    <option value="">{t('Select an owner')}</option>
                                    {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                                </select>
                            )}
                        </Field>
                    )}
                    <Field id="pf-name" label={t('Property name')} required error={errorFor('name')}>
                        {(props) => (
                            <input {...props} type="text" value={data.name} maxLength={255} autoComplete="off" placeholder={t('e.g. NDARU Building')}
                                onChange={e => setData('name', e.target.value)} onBlur={() => touch('name')} className={inputClass(props['aria-invalid'])} />
                        )}
                    </Field>
                    <Field id="pf-address" label={t('Street address')} optional error={errorFor('address')}>
                        {(props) => (
                            <input {...props} type="text" value={data.address} maxLength={255} placeholder={t('e.g. KG 123 St')}
                                onChange={e => setData('address', e.target.value)} onBlur={() => touch('address')} className={inputClass(props['aria-invalid'])} />
                        )}
                    </Field>
                </Section>

                <Section id="pf-section-location" number={2} title={t('Location')} description={t('Choose each level down to the cell.')}>
                    <fieldset aria-describedby={errorFor('cell_id') ? 'pf-location-error' : undefined}>
                        <legend className="sr-only">{t('Location')}</legend>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {[
                                { id: 'pf-province', label: t('Province'), value: place.province, options: lists.provinces, onChange: v => choosePlace('province', v), disabled: false, placeholder: t('Select Province') },
                                { id: 'pf-district', label: t('District'), value: place.district, options: lists.districts, onChange: v => choosePlace('district', v), disabled: !place.province, placeholder: t('Select District') },
                                { id: 'pf-sector', label: t('Sector'), value: place.sector, options: lists.sectors, onChange: v => choosePlace('sector', v), disabled: !place.district, placeholder: t('Select Sector') },
                                { id: 'pf-cell', label: t('Cell'), value: data.cell_id, options: lists.cells, onChange: v => { setData('cell_id', v); touch('cell_id'); }, disabled: !place.sector, placeholder: t('Select Cell') },
                            ].map(level => {
                                const invalid = Boolean(errorFor('cell_id')) && !level.value && !level.disabled;
                                return (
                                    <div key={level.id}>
                                        <label htmlFor={level.id} className="block text-sm font-medium text-gray-800">{level.label} <span className="text-red-600" aria-hidden="true">*</span></label>
                                        <select id={level.id} value={level.value} disabled={level.disabled} aria-invalid={invalid ? 'true' : undefined}
                                            onChange={e => level.onChange(e.target.value)} onBlur={() => level.id === 'pf-cell' && touch('cell_id')} className={inputClass(invalid)}>
                                            <option value="">{level.placeholder}</option>
                                            {level.options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                        {errorFor('cell_id') && <p id="pf-location-error" className="mt-2 flex items-center gap-1.5 text-sm text-red-600"><AlertCircle size={14} aria-hidden="true" />{errorFor('cell_id')}</p>}
                    </fieldset>
                </Section>

                <Section id="pf-section-building" number={3} title={t('Building')} description={t('Units are later placed on these floors.')}>
                    <div id="pf-floors" tabIndex={-1} className="focus:outline-none">
                        <BuildingFloorsFields
                            totalFloors={data.total_floors}
                            basementFloors={data.basement_floors}
                            onChange={(field, value) => { setData(field, value); touch(field); }}
                            errors={{ total_floors: errorFor('total_floors'), basement_floors: errorFor('basement_floors') }}
                        />
                    </div>
                </Section>

                <Section id="pf-section-photos" number={4} title={t('Photos')} description={t('The first photo is the cover. Up to 2 MB each.')} optional>
                    {/* The real input stays hidden; buttons open it so the page never jumps. */}
                    <input ref={photoInputRef} id="pf-photos" type="file" multiple accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true"
                        onChange={e => { addImages(e.target.files); e.target.value = ''; }} />
                    {photoCount === 0 ? (
                        <button
                            type="button"
                            id="pf-photos-button"
                            onClick={openPhotoPicker}
                            {...dropHandlers}
                            className={`group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40 ${dragging ? 'scale-[1.01] border-[#0E3B2E] bg-[#0E3B2E]/5' : 'border-gray-300 bg-gray-50 hover:border-[#0E3B2E]/60 hover:bg-[#0E3B2E]/[0.03]'}`}
                        >
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#0E3B2E] shadow-sm ring-1 ring-gray-200 transition-transform duration-200 group-hover:-translate-y-0.5">
                                <ImagePlus size={26} aria-hidden="true" />
                            </span>
                            <span className="mt-3 text-base font-semibold text-gray-900">{t('Add photos')}</span>
                            <span className="mt-1 text-sm text-gray-600">{dragging ? t('Drop the photos to add them') : t('Click to choose from your device, or drag photos here')}</span>
                            <span className="mt-2 text-xs text-gray-500">{t('JPG, PNG, GIF or WebP · up to 2 MB each')}</span>
                        </button>
                    ) : (
                        <div {...dropHandlers} className={`rounded-2xl transition-colors ${dragging ? 'bg-[#0E3B2E]/5 ring-2 ring-[#0E3B2E]/40' : ''}`}>
                            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {savedImages.map(image => {
                                    const removed = removedImageIds.includes(image.id);
                                    return (
                                        <li key={`saved-${image.id}`} className="group relative aspect-[4/3] animate-fade-in overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                                            <img src={imageSource(image.image_path)} alt="" className={`h-full w-full object-cover transition-all duration-300 ${removed ? 'opacity-30 grayscale' : 'group-hover:scale-[1.03]'}`} />
                                            {coverKey === `saved-${image.id}` && <span className="absolute bottom-2 left-2 rounded-full bg-[#0E3B2E] px-2.5 py-0.5 text-xs font-semibold text-white shadow">{t('Cover')}</span>}
                                            {removed && <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-800">{t('Will be removed')}</span>}
                                            <button type="button" onClick={() => setRemovedImageIds(ids => removed ? ids.filter(id => id !== image.id) : [...ids, image.id])}
                                                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold text-gray-800 shadow transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]"
                                                aria-label={removed ? t('Keep this photo') : t('Remove this photo')}>
                                                {removed ? <><Undo2 size={12} aria-hidden="true" />{t('Keep')}</> : <X size={14} aria-hidden="true" />}
                                            </button>
                                        </li>
                                    );
                                })}
                                {newImages.map((image, index) => (
                                    <li key={image.url} className="group relative aspect-[4/3] animate-fade-in overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                                        <img src={image.url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                                        <span className={`absolute bottom-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-semibold shadow ${coverKey === image.url ? 'bg-[#0E3B2E] text-white' : 'bg-white/95 text-gray-800'}`}>
                                            {coverKey === image.url ? t('Cover') : t('New')}
                                        </span>
                                        <button type="button" onClick={() => removeNewImage(index)}
                                            className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-gray-800 shadow transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]"
                                            aria-label={t('Remove :file', { file: image.file.name })}>
                                            <X size={14} aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                                <li className="aspect-[4/3]">
                                    <button type="button" id="pf-photos-button" onClick={openPhotoPicker}
                                        className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-sm font-semibold text-[#0E3B2E] transition-colors hover:border-[#0E3B2E]/60 hover:bg-[#0E3B2E]/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40">
                                        <ImagePlus size={22} aria-hidden="true" />
                                        {t('Add more')}
                                    </button>
                                </li>
                            </ul>
                            <p className="mt-2 text-xs text-gray-600" aria-live="polite">{t(':count photos selected', { count: photoCount })}</p>
                        </div>
                    )}
                    {(imageNotice || shownErrors.images) && (
                        <p className="mt-2 flex items-start gap-1.5 text-sm text-red-600" role="alert"><AlertCircle size={14} className="mt-0.5 flex-none" aria-hidden="true" />{imageNotice || shownErrors.images}</p>
                    )}
                </Section>

                <Section id="pf-section-amenities" number={5} title={t('Amenities & nearby')} description={t('Tap everything that applies.')} optional>
                    <ChipGroup title={t('Amenities')} items={AMENITIES} values={data.amenities} onToggle={key => toggle('amenities', key)} />
                    <ChipGroup title={t('Nearby')} items={PROXIMITY} values={data.proximity} onToggle={key => toggle('proximity', key)} />
                </Section>

                <Section id="pf-section-description" number={6} title={t('Description')} description={t('Write it yourself or let AI draft it from the details above.')} optional>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor="pf-description" className="text-sm font-medium text-gray-800">{t('Description')}</label>
                        <button type="button" onClick={generateDescription} disabled={ai.busy}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#0E3B2E]/30 bg-[#0E3B2E]/5 px-3 py-2 text-xs font-semibold text-[#0E3B2E] transition-colors hover:bg-[#0E3B2E]/10 disabled:opacity-60">
                            {ai.busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                            {ai.busy ? t('Writing...') : t('Write with AI')}
                        </button>
                    </div>
                    <textarea id="pf-description" rows={7} value={data.description} onChange={e => setData('description', e.target.value)}
                        aria-invalid={errorFor('description') ? 'true' : undefined}
                        className={inputClass(Boolean(errorFor('description')))} placeholder={t('What makes this building a good place to rent?')} />
                    <div className="mt-1 flex justify-between gap-3 text-xs">
                        <p aria-live="polite" className={ai.tone === 'warning' ? 'text-amber-800' : 'text-gray-600'}>{ai.message}</p>
                        <span className="flex-none text-gray-500">{t(':count characters', { count: data.description.length })}</span>
                    </div>
                    {errorFor('description') && <p className="mt-1 text-sm text-red-600">{errorFor('description')}</p>}
                </Section>
            </div>

            <aside className="hidden lg:block">
                <div className="sticky top-24 space-y-4">
                    <nav aria-label={t('Form progress')} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <p className="text-sm font-semibold text-gray-900">{isEdit ? t('Edit property') : t('New property')}</p>
                        <ol className="mt-3 space-y-1">
                            {steps.map((step, index) => (
                                <li key={step.id}>
                                    <a href={`#${step.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                                        {step.done
                                            ? <CheckCircle2 size={17} className="flex-none text-[#0E3B2E]" aria-hidden="true" />
                                            : <Circle size={17} className="flex-none text-gray-300" aria-hidden="true" />}
                                        <span className={step.done ? 'font-medium text-gray-900' : ''}>{index + 1}. {step.label}</span>
                                        {step.optional && <span className="ml-auto text-[11px] text-gray-500">{t('optional')}</span>}
                                        <span className="sr-only">{step.done ? t('complete') : t('not complete')}</span>
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>
                    <SaveButtons isEdit={isEdit} processing={processing} progress={uploadProgress} busy={ai.busy} cancelHref={isEdit ? route('properties.show', property.id) : route('properties.index')} stacked />
                </div>
            </aside>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
                <SaveButtons isEdit={isEdit} processing={processing} progress={uploadProgress} busy={ai.busy} cancelHref={isEdit ? route('properties.show', property.id) : route('properties.index')} />
            </div>
        </form>
    );
}

function Section({ id, number, title, description, optional = false, children }) {
    const { t } = useTranslation();

    return (
        <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#0E3B2E]/10 text-sm font-bold text-[#0E3B2E]" aria-hidden="true">{number}</span>
                <div>
                    <h2 id={`${id}-title`} className="text-base font-semibold text-gray-900">
                        {title}
                        {optional && <span className="ml-2 text-xs font-normal text-gray-500">({t('optional')})</span>}
                    </h2>
                    {description && <p className="mt-0.5 text-sm text-gray-600">{description}</p>}
                </div>
            </div>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

function Field({ id, label, required = false, optional = false, hint, error, children }) {
    const { t } = useTranslation();
    const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-800">
                {label}
                {required && <span className="text-red-600" aria-hidden="true"> *</span>}
                {optional && <span className="font-normal text-gray-500"> ({t('optional')})</span>}
            </label>
            {children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-required': required ? 'true' : undefined, 'aria-describedby': describedBy })}
            {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-gray-600">{hint}</p>}
            {error && (
                <p id={`${id}-error`} className="mt-1 flex items-center gap-1.5 text-sm text-red-600">
                    <AlertCircle size={14} className="flex-none" aria-hidden="true" />{error}
                </p>
            )}
        </div>
    );
}

function ChipGroup({ title, items, values, onToggle }) {
    const { t } = useTranslation();

    return (
        <fieldset>
            <legend className="text-sm font-medium text-gray-800">{title}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
                {items.map(({ key, label, icon: Icon }) => {
                    const on = Boolean(values[key]);
                    return (
                        <button key={key} type="button" aria-pressed={on} onClick={() => onToggle(key)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40 ${on ? 'border-[#0E3B2E] bg-[#0E3B2E] text-white shadow-sm' : 'border-gray-300 bg-white text-gray-700 hover:border-[#0E3B2E]/50 hover:bg-gray-50'}`}>
                            <Icon size={15} aria-hidden="true" />
                            {t(label)}
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

function SaveButtons({ isEdit, processing, progress = null, busy, cancelHref, stacked = false }) {
    const { t } = useTranslation();

    return (
        <div className={`flex gap-3 ${stacked ? 'flex-col' : ''}`}>
            <button type="submit" disabled={processing || busy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#124B3A] disabled:opacity-60">
                {processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Building2 size={16} aria-hidden="true" />}
                {processing ? (progress !== null && progress < 100 ? t('Uploading photos :percent%', { percent: progress }) : t('Saving...')) : (isEdit ? t('Save changes') : t('Create property'))}
            </button>
            <Link href={cancelHref} className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                {t('Cancel')}
            </Link>
        </div>
    );
}
