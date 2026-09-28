import { Head, InfiniteScroll, Link, router, useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import {
    ArrowRight,
    Building2,
    CheckCircle2,
    Coffee,
    Home,
    Mail,
    Lock,
    Loader2,
    MapPin,
    Menu,
    MessageCircle,
    Phone,
    Search,
    Store,
    Warehouse,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

const heroSlides = [
    {
        title: 'Premium offices in Kigali',
        subtitle: 'A better address for ambitious teams',
        price: 'From 21,750 RWF / m²',
        location: 'Kacyiru, Kigali',
        image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1800&q=88',
    },
    {
        title: 'Spaces made for business',
        subtitle: 'Move into a workspace that works for you',
        price: 'Flexible commercial spaces',
        location: 'Nyarutarama, Kigali',
        image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=88',
    },
    {
        title: 'Beautiful places to grow',
        subtitle: 'Discover offices, shops, cafés and more',
        price: 'Ready-to-rent properties',
        location: 'Kigali, Rwanda',
        image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=88',
    },
];

const categories = [
    { slug: 'offices', name: 'Offices', icon: Building2, image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=700&q=82' },
    { slug: 'apartments', name: 'Apartments', icon: Home, image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=700&q=82' },
    { slug: 'coffee-shops', name: 'Coffee Shops', icon: Coffee, image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=82' },
    { slug: 'commercial-buildings', name: 'Commercial Buildings', icon: Store, image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=700&q=82' },
    { slug: 'warehouses', name: 'Warehouses', icon: Warehouse, image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=700&q=82' },
];

const unitLocation = (unit) => [
    unit.property?.cell?.sector?.name,
    unit.property?.cell?.sector?.district?.name,
    unit.property?.cell?.sector?.district?.province?.name,
].filter(Boolean).join(', ') || unit.property?.address || 'Kigali, Rwanda';

const unitImage = (unit) => {
    const image = unit.images?.find((item) => item.is_cover) || unit.images?.[0]
        || unit.property?.images?.find((item) => item.is_cover) || unit.property?.images?.[0];
    if (!image?.image_path) return null;
    return /^https?:\/\//i.test(image.image_path) ? image.image_path : `/storage/${image.image_path}`;
};

const unitRent = (unit, t) => {
    if (unit.rent_amount === null || unit.rent_amount === undefined) return t('Price on request');
    const frequency = {
        daily: 'day',
        weekly: 'week',
        monthly: 'month',
        quarterly: 'quarter',
        yearly: 'year',
    }[unit.rent_frequency] || unit.rent_frequency;
    return `${new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 }).format(Number(unit.rent_amount))} RWF / ${t(frequency)}`;
};

function UnitCard({ unit }) {
    const { t } = useTranslation();
    const property = unit.property;
    const image = unitImage(unit);
    const typeLabel = unit.unit_type?.name || 'Rental space';
    const location = unitLocation(unit);

    return (
        <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <Link href={route('public.units.show', [property.id, unit.id])} className="block">
                <div className="relative h-52 overflow-hidden bg-slate-100">
                    {image ? <img src={image} alt={`${typeLabel} in ${property.name}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-[#064b78]/40"><Building2 size={56} /></div>}
                    <span className="absolute left-4 top-4 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{t('Available')}</span>
                </div>
                <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#0e3b2e]">{typeLabel}</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900 transition group-hover:text-[#078dcc]">{property.name} · Unit {unit.unit_number}</h3>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={14} /> {location}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                        {unit.floor_number !== null && unit.floor_number !== undefined && <span>Floor {unit.floor_number}</span>}
                        {unit.size_sqm && <span>{Number(unit.size_sqm).toLocaleString()} m²</span>}
                    </div>
                    <p className="mt-4 text-base font-bold text-[#0798e6]">{unitRent(unit, t)}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#0e3b2e]">{t('View details')} <ArrowRight size={15} /></span>
                </div>
            </Link>
        </article>
    );
}

function InquiryPanel({ onClose }) {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                <div className="flex items-start justify-between">
                    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">{t('Free enquiry')}</p><h2 className="mt-2 text-2xl font-bold text-slate-900">{t('Find your next space')}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{t('Tell us what you are looking for and our property team will contact you.')}</p></div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button>
                </div>
                <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); onClose(); }}>
                    <div className="grid gap-4 sm:grid-cols-2"><input required placeholder={t('Your name')} className="rounded-xl border-slate-200" /><input required placeholder={t('Phone / WhatsApp')} className="rounded-xl border-slate-200" /></div>
                    <input type="email" placeholder={t('Email (optional)')} className="w-full rounded-xl border-slate-200" />
                    <select className="w-full rounded-xl border-slate-200"><option>{t('What type of space?')}</option><option>{t('Office')}</option><option>{t('Apartment')}</option><option>{t('Coffee shop')}</option><option>{t('Commercial building')}</option><option>{t('Warehouse')}</option></select>
                    <textarea required rows="4" placeholder={t('Describe the space you need...')} className="w-full rounded-xl border-slate-200" />
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0e3b2e] px-5 py-3 font-bold text-white hover:bg-[#175640]">{t('Send enquiry')} <MessageCircle size={16} /></button>
                </form>
            </div>
        </div>
    );
}

function LoginPanel({ onClose, canRegister }) {
    const { t } = useTranslation();
    const form = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (event) => {
        event.preventDefault();
        form.post(route('login'), {
            preserveState: true,
            preserveScroll: true,
            onFinish: () => form.reset('password'),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="welcome-login-title">
            <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl">
                <button type="button" onClick={onClose} aria-label="Close login" className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={19} /></button>
                <div className="grid grid-cols-2 gap-2 p-3">
                    <div className="rounded-lg bg-[#0E3B2E] py-2.5 text-center text-sm font-semibold text-white shadow-sm">{t('Login')}</div>
                    {canRegister ? <Link href={route('register')} className="rounded-lg bg-gray-100 py-2.5 text-center text-sm font-semibold text-gray-500 transition hover:bg-gray-200">{t('Register')}</Link> : <div className="rounded-lg bg-gray-100 py-2.5 text-center text-sm font-semibold text-gray-400">{t('Register')}</div>}
                </div>
                <div className="px-6 pb-8 pt-5 sm:px-10">
                    <div className="text-center">
                        <h2 id="welcome-login-title" className="font-[Sora] text-xl font-bold text-gray-800">{t('Welcome back')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t('Log in to continue')}</p>
                    </div>
                    <form onSubmit={submit} className="mt-7 space-y-4">
                        <div>
                            <label htmlFor="welcome-login-email" className="mb-1 block text-sm font-medium text-gray-700">{t('Email')}</label>
                            <div className="relative">
                                <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input id="welcome-login-email" type="email" value={form.data.email} autoComplete="username" autoFocus disabled={form.processing} onChange={(event) => form.setData('email', event.target.value)} className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-1 focus:ring-[#0E3B2E] disabled:bg-gray-50" required />
                            </div>
                            <InputError message={form.errors.email} className="mt-1" />
                        </div>
                        <div>
                            <label htmlFor="welcome-login-password" className="mb-1 block text-sm font-medium text-gray-700">{t('Password')}</label>
                            <div className="relative">
                                <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input id="welcome-login-password" type="password" value={form.data.password} autoComplete="current-password" disabled={form.processing} onChange={(event) => form.setData('password', event.target.value)} className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-1 focus:ring-[#0E3B2E] disabled:bg-gray-50" required />
                            </div>
                            <InputError message={form.errors.password} className="mt-1" />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={form.data.remember} disabled={form.processing} onChange={(event) => form.setData('remember', event.target.checked)} className="rounded border-gray-300 text-[#0E3B2E] focus:ring-[#0E3B2E]" /> {t('Remember me')}</label>
                            <Link href={route('password.request')} className="text-sm text-[#0E3B2E] hover:underline">{t('Forgot password?')}</Link>
                        </div>
                        <button type="submit" disabled={form.processing} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0a2e23] disabled:cursor-not-allowed disabled:opacity-80">
                            {form.processing ? <><Loader2 size={18} className="animate-spin text-[#D9A441]" /> {t('Signing you in...')}</> : <><span>{t('LOG IN')}</span><ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></>}
                        </button>
                        <p className="text-center text-sm text-gray-500">{t("Don't have an account?")} {canRegister ? <Link href={route('register')} className="font-medium text-[#0E3B2E] hover:underline">{t('Register')}</Link> : t('Register')}</p>
                    </form>
                </div>
            </div>
        </div>
    );
}

function RegisterPanel({ onClose }) {
    const { t } = useTranslation();
    const form = useForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (event) => {
        event.preventDefault();
        form.post(route('register'), {
            onFinish: () => form.reset('password', 'password_confirmation'),
        });
    };

    const fields = [
        ['first_name', 'First name', 'text', 'Jean'],
        ['last_name', 'Last name', 'text', 'Sibomana'],
        ['email', 'Email', 'email', 'you@example.com'],
        ['phone', 'Phone number', 'tel', '078XXXXXXX'],
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="welcome-register-title">
            <div className="relative my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
                <button type="button" onClick={onClose} aria-label="Close registration" className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={19} /></button>
                <div className="grid grid-cols-2 gap-2 p-3">
                    <div className="rounded-lg bg-gray-100 py-2.5 text-center text-sm font-semibold text-gray-500">{t('Login')}</div>
                    <div className="rounded-lg bg-[#0E3B2E] py-2.5 text-center text-sm font-semibold text-white shadow-sm">{t('Register')}</div>
                </div>
                <div className="px-6 pb-8 pt-5 sm:px-10">
                    <div className="text-center">
                        <h2 id="welcome-register-title" className="font-[Sora] text-xl font-bold text-gray-800">{t('Create your account')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t('Join Ituze-Qra Ltd to manage your property listings.')}</p>
                    </div>
                    <form onSubmit={submit} className="mt-7 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            {fields.map(([name, label, type, placeholder]) => (
                                <div key={name}>
                                    <label htmlFor={`welcome-register-${name}`} className="mb-1 block text-sm font-medium text-gray-700">{t(label)}</label>
                                    <input id={`welcome-register-${name}`} type={type} value={form.data[name]} placeholder={placeholder} autoComplete={name === 'email' ? 'username' : name === 'phone' ? 'tel' : name === 'first_name' ? 'given-name' : 'family-name'} onChange={(event) => form.setData(name, name === 'phone' ? event.target.value.replace(/\D/g, '') : event.target.value)} className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-[#0E3B2E] focus:ring-1 focus:ring-[#0E3B2E]" required />
                                    <InputError message={form.errors[name]} className="mt-1" />
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="welcome-register-password" className="mb-1 block text-sm font-medium text-gray-700">Password</label>
                                <input id="welcome-register-password" type="password" value={form.data.password} autoComplete="new-password" onChange={(event) => form.setData('password', event.target.value)} className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-[#0E3B2E] focus:ring-1 focus:ring-[#0E3B2E]" required />
                                <InputError message={form.errors.password} className="mt-1" />
                            </div>
                            <div>
                                <label htmlFor="welcome-register-password-confirmation" className="mb-1 block text-sm font-medium text-gray-700">Confirm password</label>
                                <input id="welcome-register-password-confirmation" type="password" value={form.data.password_confirmation} autoComplete="new-password" onChange={(event) => form.setData('password_confirmation', event.target.value)} className="w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-[#0E3B2E] focus:ring-1 focus:ring-[#0E3B2E]" required />
                                <InputError message={form.errors.password_confirmation} className="mt-1" />
                            </div>
                        </div>
                        <button type="submit" disabled={form.processing} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] py-3 text-sm font-semibold text-white transition hover:bg-[#0a2e23] disabled:cursor-not-allowed disabled:opacity-70">{form.processing ? 'Creating account...' : 'Create account'} <ArrowRight size={16} /></button>
                        <p className="text-center text-xs text-gray-500">Your account will be reviewed before property management access is enabled.</p>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function Welcome({ auth, canLogin, canRegister, units, propertyCategories = [], locations = {}, searchFilters = {} }) {
    const { t } = useTranslation();
    const [slide, setSlide] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [inquiryOpen, setInquiryOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [partnerContactSent, setPartnerContactSent] = useState(false);
    const [searchForm, setSearchForm] = useState({
        search: searchFilters.search || '',
        category: searchFilters.category || '',
        province_id: searchFilters.province_id || '',
        district_id: searchFilters.district_id || '',
        sector_id: searchFilters.sector_id || '',
        price_range: searchFilters.price_range || 'any',
    });
    const current = heroSlides[slide];
    const companyPhone = '+250789265436';
    const companyAddress = 'KG 14 Ave, Kigali-Gisozi-Musezero: ULK-Kagugu Road, Source Oil Building';
    const companyMapUrl = 'https://www.google.com/maps/search/?api=1&query=KG%2014%20Ave%2C%20Kigali-Gisozi-Musezero%3A%20ULK-Kagugu%20Road%2C%20Source%20Oil%20Building';

    useEffect(() => {
        const timer = window.setInterval(() => setSlide((value) => (value + 1) % heroSlides.length), 6500);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        setSearchForm({
            search: searchFilters.search || '',
            category: searchFilters.category || '',
            province_id: searchFilters.province_id || '',
            district_id: searchFilters.district_id || '',
            sector_id: searchFilters.sector_id || '',
            price_range: searchFilters.price_range || 'any',
        });
    }, [searchFilters.search, searchFilters.category, searchFilters.province_id, searchFilters.district_id, searchFilters.sector_id, searchFilters.price_range]);

    const applySearch = (filters) => {
        router.get('/', filters, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onSuccess: () => {
                document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            },
        });
    };

    const submitSearch = (event) => {
        event.preventDefault();
        applySearch(searchForm);
    };

    const clearSearch = () => {
        const emptyFilters = { search: '', category: '', province_id: '', district_id: '', sector_id: '', price_range: 'any' };
        setSearchForm(emptyFilters);
        router.get('/', {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const availableDistricts = (locations.districts || []).filter((district) => !searchForm.province_id || String(district.province_id) === String(searchForm.province_id));
    const availableSectors = (locations.sectors || []).filter((sector) => !searchForm.district_id || String(sector.district_id) === String(searchForm.district_id));

    return (
        <>
            <Head title={t('Find your perfect space to rent | Ituze-Qra Ltd')} />
            <div className="min-h-screen bg-[#f6f8fa] text-slate-900">
                <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
                    <div className="bg-[#063f67] text-white">
                        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-3.5 text-xs font-medium sm:flex-row sm:items-center sm:justify-between lg:px-8">
                            <a href={companyMapUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-white/85 transition hover:text-white">
                                <MapPin size={16} className="shrink-0 text-[#f0a052]" />
                                <span>{companyAddress}</span>
                            </a>
                            <div className="flex items-center gap-4">
                                <a href={`tel:${companyPhone}`} className="flex items-center gap-1.5 text-white/90 transition hover:text-white">
                                    <Phone size={16} className="text-[#f0a052]" />
                                    <span>{companyPhone}</span>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
                        <Link href="/" className="flex items-center gap-3 text-2xl font-black tracking-tight text-[#064b78]">
                            <img src="/images/logo.png" alt="Ituze-Qra Ltd Logo" className="h-10 w-10 rounded-full object-contain bg-white p-0.5 shadow-sm" />
                            <span>Ituze-Qra Ltd</span>
                        </Link>
                        <nav className="hidden items-center gap-8 text-xs font-bold uppercase text-slate-700 md:flex"><a href="#featured" className="hover:text-[#078dcc]">{t('Home')}</a><a href="#featured" className="hover:text-[#078dcc]">{t('Properties')}</a><a href="#categories" className="hover:text-[#078dcc]">{t('Property types')}</a><a href="#enquiry" className="hover:text-[#078dcc]">{t('Enquiry')}</a></nav>
                        <div className="flex items-center gap-2"><LanguageSwitcher className="rounded-lg bg-[#0E3B2E] p-1" />{auth?.user ? <Link href={route('dashboard')} className="rounded bg-[#08a8ec] px-4 py-2 text-xs font-bold uppercase text-white">{t('Dashboard')}</Link> : <>{canLogin && <button type="button" onClick={() => setLoginOpen(true)} className="hidden px-3 py-2 text-xs font-bold uppercase text-slate-600 sm:block">{t('Log in')}</button>}<button type="button" onClick={() => setInquiryOpen(true)} className="rounded bg-[#08a8ec] px-4 py-2 text-xs font-bold uppercase text-white">{t('Inquiry')}</button></>}<button type="button" className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
                    </div>
                    {menuOpen && <div className="border-t border-slate-100 px-6 py-3 text-sm md:hidden"><a className="block py-2" href="#featured">{t('Properties')}</a><a className="block py-2" href="#categories">{t('Property types')}</a><a className="block py-2" href="#enquiry">{t('Enquiry')}</a>{!auth?.user && canLogin && <button type="button" onClick={() => { setLoginOpen(true); setMenuOpen(false); }} className="block py-2 font-semibold text-slate-700">{t('Log in')}</button>}{!auth?.user && <button type="button" onClick={() => { setInquiryOpen(true); setMenuOpen(false); }} className="block py-2 font-semibold text-[#078dcc]">{t('Inquiry')}</button>}</div>}
                </header>

                <main>
                    <section className="relative h-[31rem] overflow-hidden bg-[#0e3b2e]">
                        {heroSlides.map((item, index) => <img key={item.image} src={item.image} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${index === slide ? 'opacity-60' : 'opacity-0'}`} />)}
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/35 to-transparent" />
                        <div className="relative mx-auto flex h-full max-w-7xl items-center px-6 lg:px-8"><div className="max-w-2xl text-white"><p className="flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-orange-400" /> {t(current.location)}</p><h1 className="mt-5 text-5xl font-light leading-tight sm:text-7xl">{t(current.title)}</h1><p className="mt-4 text-lg font-medium text-white/85">{t(current.subtitle)}</p><p className="mt-6 text-2xl font-bold">{t(current.price)}</p><button type="button" onClick={() => setInquiryOpen(true)} className="mt-8 inline-flex items-center gap-2 bg-orange-500 px-7 py-3.5 text-sm font-bold text-white hover:bg-orange-600">{t('Make an enquiry')} <ArrowRight size={16} /></button></div></div>
                    </section>

                    <section className="relative z-10 mx-auto -mt-7 max-w-7xl px-6 lg:px-8">
                        <form onSubmit={submitSearch} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(140px,.8fr))_auto]">
                            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-4 text-sm text-slate-500">
                                <Search size={18} className="shrink-0" />
                                <input value={searchForm.search} onChange={(event) => setSearchForm((currentForm) => ({ ...currentForm, search: event.target.value }))} placeholder={t('Location or property name')} aria-label={t('Search by location or property name')} className="w-full border-0 p-0 outline-none ring-0 focus:ring-0" />
                            </label>
                            <select value={searchForm.category} onChange={(event) => setSearchForm((currentForm) => ({ ...currentForm, category: event.target.value }))} aria-label="Property category" className="min-h-12 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
                                <option value="">{t('All categories')}</option>
                                {propertyCategories.map((category) => <option key={category.slug} value={category.slug}>{t(category.name)}</option>)}
                            </select>
                            <select value={searchForm.province_id} onChange={(event) => setSearchForm((currentForm) => ({ ...currentForm, province_id: event.target.value, district_id: '', sector_id: '' }))} aria-label="Province" className="min-h-12 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
                                <option value="">{t('All provinces')}</option>
                                {(locations.provinces || []).map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
                            </select>
                            <select value={searchForm.district_id} onChange={(event) => setSearchForm((currentForm) => ({ ...currentForm, district_id: event.target.value, sector_id: '' }))} aria-label="District" className="min-h-12 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
                                <option value="">{t('All districts')}</option>
                                {availableDistricts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
                            </select>
                            <select value={searchForm.sector_id} onChange={(event) => setSearchForm((currentForm) => ({ ...currentForm, sector_id: event.target.value }))} aria-label="Sector" className="min-h-12 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
                                <option value="">{t('All sectors')}</option>
                                {availableSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
                            </select>
                            <select value={searchForm.price_range} onChange={(event) => setSearchForm((currentForm) => ({ ...currentForm, price_range: event.target.value }))} aria-label="Rent range" className="min-h-12 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">
                                <option value="any">{t('Any price')}</option>
                                <option value="under-500000">{t('Under 500,000 RWF')}</option>
                                <option value="500000-1500000">500,000 - 1,500,000 RWF</option>
                                <option value="1500000-5000000">1,500,000 - 5,000,000 RWF</option>
                                <option value="5000000-plus">Over 5,000,000 RWF</option>
                            </select>
                            <button type="submit" className="min-h-12 bg-orange-500 px-8 text-sm font-bold text-white transition hover:bg-orange-600">
                                <Search size={16} className="mr-2 inline" /> {t('Search')}
                            </button>
                        </form>
                    </section>

                    {searchFilters.active && (
                        <section id="search-results" className="mx-auto max-w-7xl scroll-mt-32 px-6 pt-10 lg:px-8">
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">{t('Search results')}</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">{t(':count available :units found', { count: units.total, units: t(units.total === 1 ? 'unit' : 'units') })}</h2>
                                </div>
                                <button type="button" onClick={clearSearch} className="text-sm font-semibold text-[#064b78] transition hover:text-orange-600">{t('Clear filters')}</button>
                            </div>
                            {units.data.length ? (
                                <InfiniteScroll
                                    data="units"
                                    manual
                                    className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                                    next={({ fetch, hasMore, loadingNext }) => hasMore && (
                                        <div className="col-span-full flex justify-center">
                                            <button type="button" onClick={fetch} disabled={loadingNext} className="rounded-lg bg-[#0e3b2e] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#175640] disabled:opacity-60">
                                                {loadingNext ? t('Loading...') : t('Load more units')}
                                            </button>
                                        </div>
                                    )}
                                >
                                    {units.data.map((unit) => <UnitCard key={unit.id} unit={unit} />)}
                                </InfiniteScroll>
                            ) : (
                                <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                                    <Search className="mx-auto text-slate-400" size={30} />
                                    <p className="mt-3 font-semibold text-slate-800">{t('No matching available units')}</p>
                                    <p className="mt-1 text-sm text-slate-500">{t('Try a different location, property type, or price range.')}</p>
                                </div>
                            )}
                        </section>
                    )}

                    {!searchFilters.active && (
                        <section id="featured" className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
                            <div className="text-center">
                                <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">{t('Available now')}</p>
                                <h2 className="mt-3 text-4xl font-light">{t('Discover Available Rental Units')}</h2>
                                <p className="mt-3 text-sm text-slate-500">{t('Browse individual spaces, see their details, and contact the property owner.')}</p>
                            </div>
                            {units.data.length ? (
                                <InfiniteScroll
                                    data="units"
                                    manual
                                    className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                                    next={({ fetch, hasMore, loadingNext }) => hasMore && (
                                        <div className="col-span-full flex justify-center">
                                            <button type="button" onClick={fetch} disabled={loadingNext} className="rounded-lg bg-[#0e3b2e] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#175640] disabled:opacity-60">
                                                {loadingNext ? t('Loading...') : t('Load more units')}
                                            </button>
                                        </div>
                                    )}
                                >
                                    {units.data.map((unit) => <UnitCard key={unit.id} unit={unit} />)}
                                </InfiniteScroll>
                            ) : (
                                <div className="mt-7 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">{t('There are no available units yet. Please check back soon.')}</div>
                            )}
                        </section>
                    )}

                    <section id="categories" className="bg-white"><div className="mx-auto max-w-7xl px-6 py-12 lg:px-8"><div className="text-center"><h2 className="text-4xl font-light">{t('Explore Our Categories')}</h2><p className="mt-3 text-sm text-slate-500">{t('Choose a category to see available listings.')}</p></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{categories.map(({ slug, name, icon: Icon, image }) => { const categoryName = propertyCategories.find((category) => category.slug === slug)?.name || name; return <button type="button" key={slug} onClick={() => { const filters = { ...searchForm, category: slug }; setSearchForm(filters); applySearch(filters); }} className="group relative h-60 overflow-hidden bg-[#0e3b2e] text-left"><img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-110" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" /><div className="absolute inset-x-5 bottom-5 text-white"><Icon size={22} /><h3 className="mt-3 text-xl font-bold">{t(categoryName)}</h3><p className="mt-1 text-xs text-white/75">{t('Browse available spaces')}</p></div></button>; })}</div></div></section>

                    <section id="enquiry" className="mx-auto max-w-7xl px-6 py-12 lg:px-8"><div className="grid overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 lg:grid-cols-[1fr_420px]"><div className="relative min-h-80 bg-[#0e3b2e] p-8 text-white sm:p-12"><div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,59,46,.72),rgba(6,75,120,.8)),url('https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85')] bg-cover bg-center" /><div className="relative max-w-lg"><p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">{t('Need help finding a space?')}</p><h2 className="mt-4 text-4xl font-light">{t('Tell us what you are looking for.')}</h2><p className="mt-5 leading-7 text-white/75">{t('Our team can help you find an office, apartment, café, commercial building, or warehouse in Kigali.')}</p><button type="button" onClick={() => setInquiryOpen(true)} className="mt-8 inline-flex items-center gap-2 rounded bg-orange-500 px-6 py-3 font-bold hover:bg-orange-600">{t('Start an enquiry')} <MessageCircle size={17} /></button></div></div><div className="flex flex-col justify-center p-8 sm:p-12"><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">{t('Talk to Ituze')}</p><h3 className="mt-3 text-2xl font-bold">{t('A smoother way to rent.')}</h3><div className="mt-6 space-y-4 text-sm text-slate-600"><p className="flex items-center gap-3"><CheckCircle2 className="text-emerald-600" size={18} /> {t('No account required to browse')}</p><p className="flex items-center gap-3"><CheckCircle2 className="text-emerald-600" size={18} /> {t('Direct owner enquiries')}</p><p className="flex items-center gap-3"><CheckCircle2 className="text-emerald-600" size={18} /> {t('WhatsApp-ready communication')}</p></div><div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold text-[#0e3b2e]"><a href={`tel:${companyPhone}`}><Phone size={16} className="mr-1 inline" /> {t('Call us')}</a><a href="mailto:hello@ituze.rw"><Mail size={16} className="mr-1 inline" /> {t('Email us')}</a></div></div></div></section>
                    <section className="border-t border-slate-100 bg-[#f6f8fa]">
                        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
                            <div className="text-center">
                                <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">{t('Built together')}</p>
                                <h2 className="mt-3 text-4xl font-light text-slate-900">{t('Our Partners')}</h2>
                                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">{t('We work with trusted property owners, business communities, relocation teams, and local enterprises to make finding the right space easier.')}</p>
                            </div>
                            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {[
                                    ['Property owners', 'Quality spaces from people who know their properties best.'],
                                    ['Business communities', 'Connections that help teams find the right Kigali address.'],
                                    ['Relocation teams', 'Practical support for people moving into a new space.'],
                                    ['Local enterprises', 'Flexible solutions for growing businesses and brands.'],
                                ].map(([title, description]) => (
                                    <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#064b78]/10 text-[#064b78]"><Building2 size={21} /></div>
                                        <h3 className="mt-4 font-bold text-slate-900">{t(title)}</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-500">{t(description)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-10 text-center">
                                <button type="button" onClick={() => setRegisterOpen(true)} className="inline-flex items-center gap-2 rounded bg-[#064b78] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#053653]">{t('Become a partner')} <ArrowRight size={16} /></button>
                            </div>
                        </div>
                    </section>
                    <section id="partner-contact" className="bg-white">
                        <div className="mx-auto grid max-w-7xl gap-0 px-6 py-14 lg:grid-cols-2 lg:px-8">
                            <div className="rounded-l-2xl bg-[#0e3b2e] p-8 text-white sm:p-12">
                                <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-300">{t('Partner with us')}</p>
                                <h2 className="mt-3 text-3xl font-light sm:text-4xl">{t('Let’s work together')}</h2>
                                <p className="mt-4 max-w-lg text-sm leading-7 text-white/75">{t('Tell us how you would like to work with Ituze-Qra Ltd. Complete the form and our team will contact you.')}</p>
                                {partnerContactSent ? (
                                    <div className="mt-8 rounded-xl bg-white/10 p-5 text-sm leading-6 text-white">
                                        {t('Thank you. Your partner enquiry has been received and our team will contact you soon.')}
                                    </div>
                                ) : (
                                    <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); setPartnerContactSent(true); }}>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <input required placeholder={t('Your name')} className="rounded-xl border-0 bg-white/95 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-300" />
                                            <input required type="tel" placeholder={t('Phone number')} className="rounded-xl border-0 bg-white/95 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-300" />
                                        </div>
                                        <input required type="email" placeholder={t('Email address')} className="w-full rounded-xl border-0 bg-white/95 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-300" />
                                        <select required defaultValue="" className="w-full rounded-xl border-0 bg-white/95 text-slate-900 focus:ring-2 focus:ring-orange-300">
                                            <option value="" disabled>{t('How would you like to partner?')}</option>
                                            <option>{t('List a property')}</option>
                                            <option>{t('Relocation support')}</option>
                                            <option>{t('Business partnership')}</option>
                                            <option>{t('Other partnership')}</option>
                                        </select>
                                        <textarea required rows="4" placeholder={t('Tell us more about your partnership idea...')} className="w-full rounded-xl border-0 bg-white/95 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-300" />
                                        <button type="submit" className="inline-flex items-center gap-2 rounded bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600">{t('Contact us')} <ArrowRight size={16} /></button>
                                    </form>
                                )}
                            </div>
                            <div className="relative min-h-[28rem] overflow-hidden rounded-r-2xl bg-slate-200">
                                <iframe title={t('Ituze-Qra Ltd location map')} src={`https://www.google.com/maps?q=${encodeURIComponent(companyAddress)}&output=embed`} className="h-full min-h-[28rem] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                                <a href={companyMapUrl} target="_blank" rel="noreferrer" className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-xl bg-white/95 p-4 text-sm text-slate-700 shadow-lg transition hover:bg-white sm:right-auto sm:max-w-md">
                                    <MapPin size={20} className="shrink-0 text-orange-600" />
                                    <span className="min-w-0 flex-1"><span className="block font-bold text-slate-900">{t('Find us on Google Maps')}</span><span className="mt-0.5 block">{companyAddress}</span></span>
                                    <ArrowRight size={16} className="shrink-0 text-[#064b78]" />
                                </a>
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="relative bg-[#063f67] text-white">
                    <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
                        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
                            <div>
                                <div className="flex items-center gap-3 text-3xl font-black">
                                    <img src="/images/logo.png" alt={t('Ituze-Qra Ltd Logo')} className="h-11 w-11 rounded-full object-contain bg-white p-0.5 shadow-sm" />
                                    <span>Ituze-Qra Ltd</span>
                                </div>
                                <p className="mt-4 max-w-xs text-sm leading-7 text-white/65">{t('Beautiful spaces, better business, and a simpler way to rent in Rwanda.')}</p>
                                <div className="mt-6 flex gap-3">
                                    <a href={`tel:${companyPhone}`} aria-label={t('Call Ituze')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#f97316]"><Phone size={17} /></a>
                                    <a href={`mailto:hello@ituze.rw`} aria-label={t('Email Ituze')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#f97316]"><Mail size={17} /></a>
                                    <a href="#enquiry" aria-label={t('Send an enquiry')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#f97316]"><MessageCircle size={17} /></a>
                                </div>
                            </div>
                            <div><h3 className="text-sm font-bold uppercase tracking-wider text-[#f0a052]">{t('Explore')}</h3><div className="mt-5 space-y-3 text-sm text-white/70"><a className="block transition hover:text-white" href="#featured">{t('Featured spaces')}</a><a className="block transition hover:text-white" href="#categories">{t('Property categories')}</a><a className="block transition hover:text-white" href="#enquiry">{t('Send an enquiry')}</a></div></div>
                            <div><h3 className="text-sm font-bold uppercase tracking-wider text-[#f0a052]">{t('For owners')}</h3><div className="mt-5 space-y-3 text-sm text-white/70"><button type="button" className="block transition hover:text-white" onClick={() => setInquiryOpen(true)}>{t('Inquiry')}</button>{canLogin && <button type="button" className="block transition hover:text-white" onClick={() => setLoginOpen(true)}>{t('Owner login')}</button>}</div></div>
                            <div><h3 className="text-sm font-bold uppercase tracking-wider text-[#f0a052]">{t('Contact us')}</h3><div className="mt-5 space-y-4 text-sm text-white/70"><a href={companyMapUrl} target="_blank" rel="noreferrer" className="flex gap-3 transition hover:text-white"><MapPin size={17} className="mt-0.5 shrink-0 text-[#f0a052]" /><span>{companyAddress}</span></a><a href={`tel:${companyPhone}`} className="flex items-center gap-3 transition hover:text-white"><Phone size={17} className="text-[#f0a052]" /> {companyPhone}</a><a href={`mailto:hello@ituze.rw`} className="flex items-center gap-3 transition hover:text-white"><Mail size={17} className="text-[#f0a052]" /> hello@ituze.rw</a></div></div>
                        </div>
                        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row"><span>© {new Date().getFullYear()} Ituze-Qra Ltd. {t('All rights reserved.')}</span><span>{t('Trusted property listings in Rwanda.')}</span></div>
                    </div>
                    <a href={`https://web.whatsapp.com/send?phone=${companyPhone.replace('+', '')}&text=${encodeURIComponent(t('Hello Ituze, I am interested in finding a property for rent.'))}`} target="_blank" rel="noreferrer" aria-label={t('Chat with Ituze on WhatsApp Web')} className="absolute bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-xl shadow-black/20 transition hover:scale-105 hover:bg-[#1fba59] sm:bottom-8 sm:right-10">
                        <MessageCircle size={27} />
                    </a>
                </footer>
            </div>
            {inquiryOpen && <InquiryPanel onClose={() => setInquiryOpen(false)} />}
            {loginOpen && <LoginPanel canRegister={canRegister} onClose={() => setLoginOpen(false)} />}
            {registerOpen && <RegisterPanel onClose={() => setRegisterOpen(false)} />}
        </>
    );
}
