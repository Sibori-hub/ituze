import { Head, Link, useForm } from '@inertiajs/react';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import {
    ArrowLeft,
    ArrowUpRight,
    Building2,
    CheckCircle2,
    ChevronRight,
    Coffee,
    Compass,
    Eye,
    Mail,
    MapPin,
    MessageCircle,
    Phone,
    Send,
    ShieldCheck,
    Sparkles,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

const locationLabel = (property) => {
    const parts = [
        property.cell?.sector?.district?.province?.name,
        property.cell?.sector?.district?.name,
        property.cell?.sector?.name,
    ].filter(Boolean);

    return parts.length ? parts.join(', ') : property.address || 'Kigali, Rwanda';
};

const formatRent = (unit, t) => {
    if (!unit?.rent_amount) return t('Price on request');
    const labels = { daily: 'day', weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year' };
    return `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Number(unit.rent_amount))} RWF / ${t(labels[unit.rent_frequency] || unit.rent_frequency)}`;
};

const listValues = (value) => (Array.isArray(value) ? value : []);

const imageSource = (path) => (/^https?:\/\//i.test(path) ? path : `/storage/${path}`);
const companyPhone = '+250789265436';
const companyAddress = 'KG 14 Ave, Kigali-Gisozi-Musezero: ULK-Kagugu Road, Source Oil Building';
const companyMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(companyAddress)}`;

const internationalPhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.startsWith('0')) return `250${digits.slice(1)}`;
    if (digits.length === 9) return `250${digits}`;
    return digits;
};

function InquiryModal({ property, unit, onClose, onSubmitted }) {
    const { t } = useTranslation();
    const form = useForm({
        unit_id: unit?.id || '',
        visitor_name: '',
        visitor_email: '',
        visitor_phone: '',
        message: '',
    });

    const submit = (event) => {
        event.preventDefault();
        form.post(route('public.properties.inquiries.store', property.id), {
            preserveScroll: true,
            onSuccess: onSubmitted,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="inquiry-title">
            <div className="my-auto w-full max-w-xl overflow-hidden rounded-[1.75rem] bg-white shadow-2xl ring-1 ring-white/20">
                <div className="relative overflow-hidden bg-gradient-to-br from-[#0e3b2e] via-[#12513d] to-[#064b78] px-6 py-6 text-white sm:px-8 sm:py-7">
                    <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[24px] border-white/5" />
                    <div className="relative flex items-start justify-between gap-4">
                        <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-white/90"><ShieldCheck size={13} /> {t('Private inquiry')}</span>
                            <h2 id="inquiry-title" className="mt-4 text-2xl font-black sm:text-3xl">{t('Let’s get you connected')}</h2>
                            <p className="mt-2 text-sm leading-6 text-white/75">{t('Send a message directly to the property owner.')}</p>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close inquiry form" className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"><X size={19} /></button>
                    </div>
                    <div className="relative mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10"><Building2 size={20} /></span>
                        <span className="min-w-0"><span className="block truncate text-sm font-bold">{unit?.unit_type?.name || t('Available rental space')}{unit?.unit_number ? ` · ${t('Unit')} ${unit.unit_number}` : ''}</span><span className="mt-0.5 block truncate text-xs text-white/65">{property.name}</span></span>
                        <span className="ml-auto shrink-0 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-100">{t('Available')}</span>
                    </div>
                </div>
                <form onSubmit={submit} className="space-y-4 p-6 sm:p-8">
                    {form.errors.inquiry && <div role="alert" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><MessageCircle size={18} className="mt-0.5 shrink-0 text-amber-600" /><span>{form.errors.inquiry}</span></div>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-600">{t('Your name')}
                            <input required value={form.data.visitor_name} onChange={(event) => form.setData('visitor_name', event.target.value)} placeholder="e.g. Alex" className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium normal-case tracking-normal text-slate-900 placeholder:font-normal focus:border-[#0e3b2e] focus:bg-white focus:ring-[#0e3b2e]" />
                        </label>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-600">{t('Phone number')}
                            <input required type="tel" value={form.data.visitor_phone} onChange={(event) => form.setData('visitor_phone', event.target.value)} placeholder="+250..." className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium normal-case tracking-normal text-slate-900 placeholder:font-normal focus:border-[#0e3b2e] focus:bg-white focus:ring-[#0e3b2e]" />
                        </label>
                    </div>
                    {form.errors.visitor_name && <p className="text-xs font-medium text-red-600">{form.errors.visitor_name}</p>}
                    {form.errors.visitor_phone && <p className="text-xs font-medium text-red-600">{form.errors.visitor_phone}</p>}
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">{t('Email address')}
                        <input required type="email" value={form.data.visitor_email} onChange={(event) => form.setData('visitor_email', event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium normal-case tracking-normal text-slate-900 placeholder:font-normal focus:border-[#0e3b2e] focus:bg-white focus:ring-[#0e3b2e]" />
                    </label>
                    {form.errors.visitor_email && <p className="-mt-2 text-xs font-medium text-red-600">{form.errors.visitor_email}</p>}
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">{t('Your message')}
                        <textarea required rows="4" value={form.data.message} onChange={(event) => form.setData('message', event.target.value)} placeholder={`Hello, I am interested in ${unit?.unit_type?.name?.toLowerCase() || 'this space'}. Is it available for viewing?`} className="mt-2 w-full resize-y rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium normal-case tracking-normal text-slate-900 placeholder:font-normal focus:border-[#0e3b2e] focus:bg-white focus:ring-[#0e3b2e]" />
                    </label>
                    {form.errors.message && <p className="-mt-2 text-xs font-medium text-red-600">{form.errors.message}</p>}
                    <button disabled={form.processing} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e3b2e] px-5 py-3.5 font-bold text-white shadow-lg shadow-[#0e3b2e]/15 transition hover:-translate-y-0.5 hover:bg-[#175640] disabled:cursor-not-allowed disabled:opacity-60">{form.processing ? t('Sending inquiry...') : t('Send inquiry to owner')} <Send size={16} /></button>
                    <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400"><ShieldCheck size={13} className="text-emerald-600" /> {t('Your details are shared only with the property owner.')}</p>
                </form>
            </div>
        </div>
    );
}

function InquiryConfirmation({ property, unit, onClose }) {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="inquiry-confirmation-title">
            <div className="my-auto w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white text-center shadow-2xl">
                <div className="bg-gradient-to-br from-[#0e3b2e] to-[#064b78] px-6 pb-8 pt-9 text-white">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10"><CheckCircle2 size={34} className="text-emerald-200" /></div>
                    <h2 id="inquiry-confirmation-title" className="mt-5 text-2xl font-black">{t('We received your inquiry!')}</h2>
                    <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/75">{t('Your message about :space at :property has been sent to the owner.', { space: unit?.unit_type?.name || t('this space'), property: property.name })}</p>
                </div>
                <div className="p-6 sm:p-8">
                    <div className="rounded-xl bg-[#f2f7f4] p-4 text-sm leading-6 text-slate-600">{t('The owner will review your details and get back to you as soon as possible, usually within a few minutes.')}</div>
                    <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-[#0e3b2e] px-5 py-3.5 font-bold text-white transition hover:bg-[#175640]">{t('Got it')}</button>
                    <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400"><ShieldCheck size={13} className="text-emerald-600" /> {t('Your contact details were shared with the owner.')}</p>
                </div>
            </div>
        </div>
    );
}

export default function PublicProperty({ property, selectedUnit: selectedUnitProp, isUnitDetail = false }) {
    const { t } = useTranslation();
    const [selectedUnit, setSelectedUnit] = useState(selectedUnitProp || property.units?.[0]);
    const [inquiryOpen, setInquiryOpen] = useState(false);
    const [inquirySubmitted, setInquirySubmitted] = useState(false);
    const [activeImage, setActiveImage] = useState(0);
    const images = selectedUnit?.images?.length ? selectedUnit.images : property.images || [];
    const amenities = listValues(property.amenities);
    const proximity = listValues(property.proximity);
    const gallery = images.length ? images : [{ image_path: null }];
    const hasMultipleImages = gallery.length > 1;
    const location = locationLabel(property);
    const ownerName = property.owner?.name || [property.owner?.first_name, property.owner?.last_name].filter(Boolean).join(' ') || 'Property owner';
    const ownerPhone = property.owner?.phone || '';
    const ownerWhatsApp = internationalPhone(ownerPhone);
    const contactMessage = `Hello, I am interested in ${selectedUnit?.unit_type?.name || 'this space'} ${selectedUnit?.unit_number ? `unit ${selectedUnit.unit_number}` : property.name} at ${property.name}.`;
    const whatsappHref = ownerWhatsApp ? `https://wa.me/${ownerWhatsApp}?text=${encodeURIComponent(contactMessage)}` : null;
    const openInquiry = () => {
        setInquiryOpen(true);
    };

    useEffect(() => {
        if (selectedUnitProp) {
            setSelectedUnit(selectedUnitProp);
            setActiveImage(0);
        }
    }, [selectedUnitProp]);

    return (
        <>
            <Head title={`${isUnitDetail ? `${selectedUnit?.unit_type?.name || 'Rental unit'} ${selectedUnit?.unit_number || ''} | ` : ''}${property.name} | Property for rent in ${location}`} />
            <div className="min-h-screen bg-[#f8faf9] text-slate-900">
                <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
                    <div className="bg-[#063f67] text-white">
                        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium sm:px-6 lg:px-8">
                            <a href={companyMapUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-white/85 transition hover:text-white">
                                <MapPin size={15} className="shrink-0 text-[#f0a052]" />
                                <span className="truncate">{companyAddress}</span>
                            </a>
                            <a href={`tel:${companyPhone}`} className="flex shrink-0 items-center gap-1.5 text-white/90 transition hover:text-white">
                                <Phone size={14} className="text-[#f0a052]" />
                                <span className="hidden sm:inline">{companyPhone}</span>
                                <span className="sm:hidden">Call us</span>
                            </a>
                            <LanguageSwitcher className="rounded-lg bg-white/10 p-1" />
                        </div>
                    </div>
                    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
                        <Link href="/" className="flex min-w-0 items-center gap-2.5 text-[#064b78] sm:gap-3">
                            <img src="/images/logo.png" alt="Ituze-Qra Ltd Logo" className="h-10 w-10 shrink-0 rounded-full bg-white p-0.5 object-contain shadow-sm" />
                            <span className="whitespace-nowrap text-base font-black tracking-tight sm:text-xl">Ituze-Qra Ltd</span>
                        </Link>
                        <nav className="hidden items-center gap-6 text-xs font-bold uppercase text-slate-700 lg:flex">
                            <Link href="/" className="transition hover:text-[#078dcc]">Home</Link>
                            <Link href="/#categories" className="transition hover:text-[#078dcc]">Property types</Link>
                        </nav>
                        <div className="flex shrink-0 items-center gap-2">
                            <button type="button" onClick={openInquiry} className="rounded-lg bg-[#08a8ec] px-3.5 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-[#078dcc] sm:px-4">{t('Contact owner')}</button>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-12">
                    <div className="mb-8 flex items-center gap-2 text-sm text-slate-500"><Link href="/" className="transition hover:text-[#0e3b2e]">Home</Link><ChevronRight size={15} /><span>{location}</span><ChevronRight size={15} /><span className="truncate text-slate-800">{isUnitDetail ? `${selectedUnit?.unit_type?.name || 'Unit'} ${selectedUnit?.unit_number || ''}` : property.name}</span></div>
                    <section className={`grid gap-3 overflow-hidden rounded-[1.75rem] bg-[#dcebe5] ${hasMultipleImages ? 'lg:grid-cols-[1.45fr_.55fr]' : ''}`}>
                        <div className={`group relative overflow-hidden ${hasMultipleImages ? 'h-[22rem] sm:h-[32rem]' : 'h-[22rem] sm:h-[36rem]'}`}>
                            {gallery[activeImage]?.image_path ? <img src={imageSource(gallery[activeImage].image_path)} alt={`${property.name}${selectedUnit ? ` unit ${selectedUnit.unit_number}` : ''}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]" /> : <div className="flex h-full items-center justify-center"><Building2 className="h-24 w-24 text-[#0e3b2e]/20" /></div>}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-slate-950/10" />
                            <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/35 px-3.5 py-2 text-xs font-bold text-white shadow-sm backdrop-blur-md"><CheckCircle2 size={14} /> {t('Available now')}</span>
                            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3 text-white">
                                <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-white/75">{selectedUnit?.unit_type?.name || 'Rental space'}</p><p className="mt-1 text-xl font-black sm:text-2xl">{selectedUnit?.unit_number ? `Unit ${selectedUnit.unit_number}` : property.name}</p></div>
                                <span className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur-md"><Eye size={13} className="mr-1 inline" /> {images.length || 1} {images.length === 1 ? 'photo' : 'photos'}</span>
                            </div>
                        </div>
                        {hasMultipleImages && <div className={`grid gap-3 lg:grid-cols-1 ${gallery.length === 2 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {[1, 2].filter((offset) => offset < gallery.length).map((offset) => {
                                const image = gallery[(activeImage + offset) % gallery.length];
                                return <button type="button" key={offset} onClick={() => setActiveImage((activeImage + offset) % gallery.length)} aria-label={`View photo ${(activeImage + offset) % gallery.length + 1}`} className="relative min-h-36 overflow-hidden bg-[#dcebe5] text-left sm:min-h-0">{image?.image_path ? <img src={imageSource(image.image_path)} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Building2 className="h-10 w-10 text-[#0e3b2e]/20" /></div>}</button>;
                            })}
                        </div>}
                    </section>

                    <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_350px]">
                        <article>
                            <div className="border-b border-slate-200 pb-8">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#b57c35]"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf5f0] px-3 py-1.5 text-[#0e3b2e]"><CheckCircle2 size={13} /> {t('Available for rent')}</span><span>{selectedUnit?.unit_type?.name || t('Rental space')}</span></div>
                                <h1 className="mt-5 text-4xl font-black leading-tight tracking-[-.03em] text-slate-900 sm:text-5xl">{isUnitDetail ? `${selectedUnit?.unit_type?.name || t('Rental Unit')} ${selectedUnit?.unit_number || ''}` : property.name}</h1>
                                {isUnitDetail && <p className="mt-2 text-sm font-medium text-slate-500">{property.name}</p>}
                                <p className="mt-4 flex items-center gap-2 text-base text-slate-500"><MapPin size={18} className="text-[#b57c35]" /> {location}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-b border-slate-200 py-7 sm:grid-cols-4">
                                <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('Rent')}</p><p className="mt-2 text-lg font-black text-[#0e3b2e]">{formatRent(selectedUnit, t)}</p></div>
                                <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('Unit')}</p><p className="mt-2 text-lg font-black text-slate-900">{selectedUnit?.unit_number || '—'}</p></div>
                                <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('Type')}</p><p className="mt-2 text-lg font-black text-slate-900">{selectedUnit?.unit_type?.name || t('Rental unit')}</p></div>
                                <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('Size / Floor')}</p><p className="mt-2 text-lg font-black text-slate-900">{selectedUnit?.size_sqm ? `${selectedUnit.size_sqm} m²` : '—'}{selectedUnit?.floor_number !== null && selectedUnit?.floor_number !== undefined ? ` · ${t('Floor')} ${selectedUnit.floor_number}` : ''}</p></div>
                            </div>
                            <section className="border-b border-slate-200 py-8"><h2 className="text-2xl font-black">{isUnitDetail ? t('Description') : t('About this property')}</h2><p className="mt-4 max-w-3xl whitespace-pre-line text-[16px] leading-8 text-slate-600">{selectedUnit?.description || property.description || t('This :type in :location is available for rent. Contact the owner to arrange a viewing and learn more.', { type: selectedUnit?.unit_type?.name?.toLowerCase() || t('rental space'), location })}</p></section>
                                    <section className="border-b border-slate-200 py-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">{t('Address')}</h2><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${property.address}, ${location}`)}`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#b57c35] px-4 py-2 text-sm font-bold text-white">{t('Open in Google Maps')}</a></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-slate-500">{t('Property')}</dt><dd className="mt-1 text-slate-800">{property.name}</dd></div><div><dt className="font-semibold text-slate-500">{t('Street address')}</dt><dd className="mt-1 text-slate-800">{property.address}</dd></div><div><dt className="font-semibold text-slate-500">{t('Location')}</dt><dd className="mt-1 text-slate-800">{location}</dd></div><div><dt className="font-semibold text-slate-500">{t('Floor')}</dt><dd className="mt-1 text-slate-800">{selectedUnit?.floor_number ?? t('Not specified')}</dd></div></dl></section>
                                    <section className="border-b border-slate-200 py-8"><h2 className="text-2xl font-black">{t('Property amenities')}</h2>{amenities.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{amenities.map((amenity) => <div key={amenity} className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-100"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf5f0] text-[#0e3b2e]"><CheckCircle2 size={16} /></span>{t(amenity)}</div>)}</div> : <p className="mt-4 text-slate-500">{t('Contact the owner for available facilities and amenities.')}</p>}</section>
                                    <section className="border-b border-slate-200 py-8"><h2 className="text-2xl font-black">{t('Nearby infrastructure')}</h2>{proximity.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{proximity.map((place) => <div key={place} className="flex items-center gap-3 text-sm text-slate-600"><Compass size={17} className="text-[#b57c35]" /> {t(place)}</div>)}</div> : <p className="mt-4 text-slate-500">{t('Strategically located with convenient access to surrounding services.')}</p>}</section>
                            <section className="py-8">
                                <h2 className="text-2xl font-black">{t(isUnitDetail ? 'Other available units in this property' : 'Available spaces')}</h2>
                                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {property.units.filter((unit) => unit.id !== selectedUnit?.id).map((unit) => {
                                        const cover = unit.images?.find((image) => image.is_cover) || unit.images?.[0];
                                        return (
                                            <Link
                                                key={unit.id}
                                                href={route('public.units.show', [property.id, unit.id])}
                                                className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#b57c35] hover:shadow-md"
                                            >
                                                {cover?.image_path && (
                                                    <img src={imageSource(cover.image_path)} alt="" className="h-16 w-20 shrink-0 rounded-xl object-cover" />
                                                )}
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-[#0e3b2e]">{unit.unit_type?.name || t('Commercial space')} · {unit.unit_number}</span>
                                                    <span className="mt-1 block truncate text-xs text-slate-500">{unit.size_sqm ? `${unit.size_sqm} m² · ` : ''}{formatRent(unit, t)}</span>
                                                </span>
                                                <ArrowLeft className="h-4 w-4 shrink-0 rotate-180 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#0e3b2e]" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            </section>
                        </article>
                        <aside id="contact-owner" className="h-fit lg:sticky lg:top-36">
                            <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_22px_60px_-32px_rgba(15,23,42,.5)]">
                                <div className="relative overflow-hidden bg-gradient-to-br from-[#0e3b2e] via-[#12513d] to-[#064b78] px-6 pb-7 pt-6 text-white">
                                    <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[26px] border-white/5" />
                                    <div className="relative flex items-center gap-4">
                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner"><Users size={25} /></div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-200">{t('Property contact')}</p>
                                            <p className="mt-1 flex items-center gap-1.5 truncate text-lg font-black">{ownerName} <CheckCircle2 size={15} className="shrink-0 text-emerald-300" /></p>
                                            <p className="mt-0.5 text-xs text-white/65">Owner · {property.name}</p>
                                            {ownerPhone && <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-white"><Phone size={13} className="shrink-0 text-emerald-200" />{ownerPhone}</p>}
                                        </div>
                                    </div>
                                    <div className="relative mt-5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                                        <span><span className="block text-[10px] font-bold uppercase tracking-wider text-white/60">{t('Monthly rent')}</span><span className="mt-1 block text-lg font-black">{formatRent(selectedUnit, t)}</span></span>
                                        <span className="rounded-full bg-emerald-300/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">{t('Available')}</span>
                                    </div>
                                </div>
                                <div className="p-5 sm:p-6">
                                    <h2 className="text-lg font-black text-slate-900">{t('Interested in this space?')}</h2>
                                    <p className="mt-1.5 text-sm leading-6 text-slate-500">{t('Ask a question or arrange a viewing directly with the owner.')}</p>
                                    <button type="button" onClick={openInquiry} className="group mt-5 flex w-full items-center justify-between rounded-xl bg-[#0e3b2e] px-4 py-3.5 text-left font-bold text-white shadow-lg shadow-[#0e3b2e]/15 transition hover:-translate-y-0.5 hover:bg-[#175640]">
                                        <span className="flex items-center gap-2.5"><MessageCircle size={18} /> {t('Send a message')}</span><ArrowUpRight size={17} className="text-white/70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                                    </button>
                                    {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#b9e8c9] bg-[#effaf3] px-3 py-3 text-sm font-bold text-[#168447] transition hover:border-[#83d59f] hover:bg-[#e2f6e9]"><MessageCircle size={17} /> {t('Chat on WhatsApp')}</a> : <span className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-400"><MessageCircle size={17} /> {t('WhatsApp unavailable')}</span>}
                                    <p className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" /> {t('Your inquiry goes to the owner dashboard. WhatsApp opens a direct chat with the owner.')}</p>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff5e8] text-[#b57c35]"><Sparkles size={18} /></span><span><span className="block text-sm font-bold text-slate-900">{t('A better way to rent')}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{t('Real spaces. Direct connections.')}</span></span></div>
                        </aside>
                    </div>
                </main>
                <footer className="bg-[#063f67] text-white">
                    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
                        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr]">
                            <div>
                                <Link href="/" className="flex items-center gap-3 text-2xl font-black">
                                    <img src="/images/logo.png" alt="" className="h-11 w-11 rounded-full bg-white p-0.5 object-contain shadow-sm" />
                                    <span>Ituze-Qra Ltd</span>
                                </Link>
                                <p className="mt-4 max-w-sm text-sm leading-7 text-white/70">{t('Beautiful spaces, better business, and a simpler way to rent in Rwanda.')}</p>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-[#f0a052]">{t('Explore')}</h2>
                                <div className="mt-4 space-y-3 text-sm text-white/75">
                                    <Link href="/" className="block transition hover:text-white">{t('Available spaces')}</Link>
                                    <Link href="/#categories" className="block transition hover:text-white">{t('Property types')}</Link>
                                    <button type="button" onClick={openInquiry} className="block transition hover:text-white">{t('Contact this owner')}</button>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-[#f0a052]">{t('Contact Ituze')}</h2>
                                <div className="mt-4 space-y-3 text-sm text-white/75">
                                    <a href={companyMapUrl} target="_blank" rel="noreferrer" className="flex items-start gap-3 transition hover:text-white"><MapPin size={17} className="mt-0.5 shrink-0 text-[#f0a052]" /><span>{companyAddress}</span></a>
                                    <a href={`tel:${companyPhone}`} className="flex items-center gap-3 transition hover:text-white"><Phone size={16} className="text-[#f0a052]" />{companyPhone}</a>
                                    <a href="mailto:hello@ituze.rw" className="flex items-center gap-3 transition hover:text-white"><Mail size={16} className="text-[#f0a052]" />hello@ituze.rw</a>
                                </div>
                            </div>
                        </div>
                        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-white/10 pt-5 text-xs text-white/55 sm:flex-row">
                            <span>© {new Date().getFullYear()} Ituze-Qra Ltd. {t('All rights reserved.')}</span>
                            <span>{t('Trusted property listings in Rwanda.')}</span>
                        </div>
                    </div>
                </footer>
                {inquiryOpen && <InquiryModal property={property} unit={selectedUnit} onClose={() => setInquiryOpen(false)} onSubmitted={() => { setInquiryOpen(false); setInquirySubmitted(true); }} />}
                {inquirySubmitted && <InquiryConfirmation property={property} unit={selectedUnit} onClose={() => setInquirySubmitted(false)} />}
            </div>
        </>
    );
}
