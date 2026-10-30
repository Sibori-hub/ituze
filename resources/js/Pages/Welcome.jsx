import { Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import BrandLockup from '@/Components/BrandLockup';
import ContactSection, { openContactForm } from '@/Components/ContactSection';
import SearchSuggestBox from '@/Components/SearchSuggestBox';
import InstallAppBanner from '@/Components/InstallAppBanner';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import LegalModal from '@/Components/LegalModal';
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
    Megaphone,
    Menu,
    MessageCircle,
    Moon,
    Phone,
    Search,
    Sun,
    Warehouse,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/localization';
import { useTheme } from '@/lib/theme';
import ThemeToggle from '@/Components/ThemeToggle';

const heroSlides = [
    {
        title: 'Premium offices in Kigali',
        subtitle: 'A better address for ambitious teams',
        price: 'Offices in the heart of Kigali',
        location: 'Kimihurura, Kigali',
        image: '/images/hero/kigali-convention-centre.jpg',
        name: 'Kigali Convention Centre',
        credit: 'Emmanuel Kwizera, CC BY-SA 4.0',
        source: 'https://commons.wikimedia.org/wiki/File:An_aerial_of_Kigali_Convention_Center_on_June_19,_2019._Photo_by_Emmanuel_Kwizera.jpg',
        category: 'offices',
        cta: 'See available spaces',
    },
    {
        title: 'Live and work near BK Arena',
        subtitle: 'Remera, the lively heart of Kigali',
        price: 'Offices, shops and apartments close to everything',
        location: 'Remera, Kigali',
        image: '/images/hero/bk-arena.jpg',
        name: 'BK Arena, Remera',
        credit: 'Igiraneza Divine, CC0',
        source: 'https://commons.wikimedia.org/wiki/File:BK_ARENA(ENTERTAINMENT_HOUSE).jpg',
    },
    {
        title: 'Apartments to call home',
        subtitle: 'Comfortable homes in green, quiet neighbourhoods',
        price: 'Furnished and unfurnished apartments',
        location: 'Kigali, Rwanda',
        image: '/images/hero/kigali-apartments.jpg',
        name: 'Balconies of a residential building in Kigali',
        credit: 'UWIMPUHWE Va, CC0',
        source: 'https://commons.wikimedia.org/wiki/File:Five_to_Five_hotel_building.jpg',
        category: 'apartments',
        cta: 'See available spaces',
    },
    {
        title: 'Spaces for coffee shops',
        subtitle: 'Welcome your customers in the right place',
        price: 'Ground floors, terraces and gardens',
        location: 'Musanze, Rwanda',
        image: '/images/hero/musanze-coffee-shop.jpg',
        name: 'A coffee shop garden in Musanze',
        credit: 'Gisa Kevin (VAWMC), CC BY-SA 4.0',
        source: 'https://commons.wikimedia.org/wiki/File:Nature_is_beauty_but_when_it_comes_to_Rwanda.jpg',
        category: 'coffee-shops',
        cta: 'See available spaces',
    },
    {
        title: 'Warehouses and storage',
        subtitle: 'Room to store, move and grow your stock',
        price: 'Space for trucks and containers',
        location: 'Kigali, Rwanda',
        image: '/images/hero/kigali-warehouse.jpg',
        name: 'Trucks at the MAGERWA warehouse, Kigali',
        credit: 'Mrbobax, CC BY-SA 4.0',
        source: 'https://commons.wikimedia.org/wiki/File:Warehouse_Trucks_parking.jpg',
        category: 'warehouses',
        cta: 'See available spaces',
    },
    {
        title: 'Spaces made for business',
        subtitle: 'Move into a workspace that works for you',
        price: 'Flexible commercial spaces',
        location: 'Nyarugenge, Kigali',
        image: '/images/hero/kigali-offices-night.jpg',
        name: 'Offices in Nyarugenge at night',
        credit: 'IsimbiP, CC BY-SA 4.0',
        source: 'https://commons.wikimedia.org/wiki/File:Kigali_long_exposure_shot.jpg',
    },
    {
        title: 'Beautiful places to grow',
        subtitle: 'Discover offices, shops, cafés and more',
        price: 'Ready-to-rent properties',
        location: 'Kigali, Rwanda',
        image: '/images/hero/kigali-city-road.jpg',
        name: 'A Kigali city road',
        credit: 'Emmanuel Kwizera, CC BY-SA 4.0',
        source: 'https://commons.wikimedia.org/wiki/File:High_Angle_View_Of_Kigali_City_Street_on_November_29,_2018._Emmanuel_Kwizera.jpg',
    },
];

const ACCOUNT_TYPES = [
    { value: 'owner', label: 'Property Owner', description: 'Manage properties, units, tenants, leases and rent payments.', Icon: Building2 },
    { value: 'advertiser', label: 'Advertiser', description: 'Promote your brand to people browsing properties on the platform.', Icon: Megaphone },
];

// "Explore by cities": each card filters listings by its province, district or sector
// (found by name). Photos: Wikimedia Commons, credited under the section.
const cities = [
    { name: 'Kigali', match: { province: 'kigali' }, image: '/images/cities/kigali.jpg', credit: 'Adrien K, CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Kigali2018Cropped.jpg' },
    { name: 'Nyamata', match: { district: 'bugesera', sector: 'nyamata' }, image: '/images/cities/nyamata.jpg', credit: 'Mugisha Don de Dieu, CC BY 2.0', source: 'https://commons.wikimedia.org/wiki/File:Palast_Rock_Hotel_located_in_Nyamata,_Bugesera_District.jpg' },
    { name: 'Rubavu', match: { district: 'rubavu' }, image: '/images/cities/rubavu.jpg', credit: 'Ericnkurunziza, CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Rubavu_and_Mount_Nyiragongo_in_Rwanda.jpg' },
    { name: 'Musanze', match: { district: 'musanze' }, image: '/images/cities/musanze.jpg', credit: 'Fikiri-jenly, CC BY 4.0', source: 'https://commons.wikimedia.org/wiki/File:Muhabura_volcano_located_at_Musanze_District.jpg' },
    { name: 'Rusizi', match: { district: 'rusizi' }, image: '/images/cities/rusizi.jpg', credit: 'Fanny Schertzer, CC BY 3.0', source: 'https://commons.wikimedia.org/wiki/File:Lake_Kivu,_Cyangugu.jpg' },
];

/** The search filters (province, district, sector ids) for one city card. */
function cityFilters(city, locations) {
    const named = (list, word) => (list || []).find((item) => item.name.toLowerCase().includes(word));
    const district = city.match.district ? named(locations.districts, city.match.district) : null;
    const sector = district && city.match.sector
        ? (locations.sectors || []).find((item) => String(item.district_id) === String(district.id) && item.name.toLowerCase().includes(city.match.sector))
        : null;
    const province = city.match.province ? named(locations.provinces, city.match.province) : null;

    return {
        province_id: String(province?.id ?? district?.province_id ?? ''),
        district_id: district ? String(district.id) : '',
        sector_id: sector ? String(sector.id) : '',
    };
}

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
    // A plain unit has no category: its use depends on the client.
    const typeLabel = !unit.unit_type?.name || unit.unit_type.name === 'Space' ? t('Space to rent') : unit.unit_type.name;
    const location = unitLocation(unit);

    return (
        <article className="group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <Link href={route('public.units.show', [property.id, unit.id])} className="block">
                <div className="relative h-52 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    {image ? <img src={image} alt={`${typeLabel} in ${property.name}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-[#064b78]/40 dark:text-sky-300/40"><Building2 size={56} /></div>}
                    <span className="absolute left-4 top-4 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{t('Available')}</span>
                </div>
                <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#0e3b2e] dark:text-emerald-300">{typeLabel}</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100 transition group-hover:text-[#078dcc]">{property.name} · Unit {unit.unit_number}</h3>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"><MapPin size={14} /> {location}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                        {unit.floor_number !== null && unit.floor_number !== undefined && <span>Floor {unit.floor_number}</span>}
                        {unit.size_sqm && <span>{Number(unit.size_sqm).toLocaleString()} m²</span>}
                    </div>
                    <p className="mt-4 text-base font-bold text-[#0798e6] dark:text-sky-400">{unitRent(unit, t)}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#0e3b2e] dark:text-emerald-300">{t('View details')} <ArrowRight size={15} /></span>
                </div>
            </Link>
        </article>
    );
}

export default function Welcome({ auth, canLogin, canRegister, units, propertyCategories = [], locations = {}, searchFilters = {} }) {
    const { t } = useTranslation();
    const [slide, setSlide] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [legalDoc, setLegalDoc] = useState(null);
    const [creditsOpen, setCreditsOpen] = useState(false);
    const [dark, toggleTheme] = useTheme();
    const [searchForm, setSearchForm] = useState({
        search: searchFilters.search || '',
        category: searchFilters.category || '',
        province_id: searchFilters.province_id || '',
        district_id: searchFilters.district_id || '',
        sector_id: searchFilters.sector_id || '',
        price_range: searchFilters.price_range || 'any',
    });
    const current = heroSlides[slide];
    const companyPhone = '+250793905166';
    const companyPhoneDisplay = '0793 905 166';
    const companyEmail = 'info@qraltd.com';
    const whatsappUrl = `https://wa.me/${companyPhone.replace('+', '')}?text=${encodeURIComponent(t('Hello Ituze, I am interested in finding a property for rent.'))}`;
    const companyAddress = 'KG 14 Ave, Kigali-Gisozi-Musezero: ULK-Kagugu Road, Source Oil Building';
    const companyMapUrl = 'https://www.google.com/maps/search/?api=1&query=KG%2014%20Ave%2C%20Kigali-Gisozi-Musezero%3A%20ULK-Kagugu%20Road%2C%20Source%20Oil%20Building';

    useEffect(() => {
        const timer = window.setTimeout(() => setSlide((value) => (value + 1) % heroSlides.length), 6500);
        return () => window.clearTimeout(timer);
    }, [slide]);

    // Results update by themselves: lists at once, typing after a short pause.
    const typingPause = useRef(true);
    const searchKey = (filters) => JSON.stringify(Object.keys(filters).sort().map((key) => [key, String(filters[key] ?? '').trim()]));
    const lastSearch = useRef(searchKey(searchForm));
    useEffect(() => {
        if (searchKey(searchForm) === lastSearch.current) return undefined;
        const timer = window.setTimeout(() => applySearch(searchForm, false), typingPause.current ? 450 : 0);
        typingPause.current = true;
        return () => window.clearTimeout(timer);
    }, [searchForm]);

    const updateSearch = (changes, typing = false) => {
        typingPause.current = typing;
        setSearchForm((currentForm) => ({ ...currentForm, ...changes }));
    };

    const applySearch = (filters, scrollToResults = true) => {
        lastSearch.current = searchKey(filters);
        // Only the filters in use go in the address: /?search=Kigali, not a row of empty ones.
        const used = Object.fromEntries(Object.entries(filters).filter(([key, value]) => String(value ?? '').trim() !== '' && !(key === 'price_range' && value === 'any')));
        router.get('/', used, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onSuccess: () => {
                if (scrollToResults) document.getElementById('search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            },
        });
    };

    const submitSearch = (event) => {
        event.preventDefault();
        applySearch(searchForm);
    };

    const clearSearch = () => {
        const emptyFilters = { search: '', category: '', province_id: '', district_id: '', sector_id: '', price_range: 'any' };
        lastSearch.current = searchKey(emptyFilters);
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
            <Head title={t('Find your perfect space to rent | ITUZE GREEN PLATFORM')} />
            <div className="min-h-screen bg-[#f6f8fa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
                <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md">
                    <div className="bg-[#063f67] text-white">
                        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-[11px] font-medium sm:px-6 sm:text-xs lg:px-8">
                            <a href={companyMapUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-white/85 transition hover:text-white">
                                <MapPin size={15} className="shrink-0 text-[#f0a052]" />
                                <span className="truncate">{companyAddress}</span>
                            </a>
                            <div className="flex shrink-0 items-center gap-3">
                                <a href={`tel:${companyPhone}`} className="flex items-center gap-1.5 text-white/90 transition hover:text-white">
                                    <Phone size={15} className="text-[#f0a052]" />
                                    <span>{companyPhoneDisplay}</span>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
                        <Link href="/" className="rounded-xl text-[#064b78] dark:text-sky-300">
                            <BrandLockup
                                logoClassName="h-12 w-12 sm:h-16 sm:w-16 dark:rounded-xl dark:bg-white"
                                nameClassName="text-xs font-black sm:text-sm"
                                subtitleClassName="text-[8px] font-semibold sm:text-[9px]"
                            />
                        </Link>
                        <nav className="hidden items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300 md:flex">
                            <a href="#featured" className="rounded-full px-3 py-2 transition hover:bg-white dark:hover:bg-slate-700 hover:text-[#078dcc]">{t('Home')}</a>
                            <a href="#featured" className="rounded-full px-3 py-2 transition hover:bg-white dark:hover:bg-slate-700 hover:text-[#078dcc]">{t('Properties')}</a>
                            <a href="#cities" className="rounded-full px-3 py-2 transition hover:bg-white dark:hover:bg-slate-700 hover:text-[#078dcc]">{t('Cities')}</a>
                            <a href="#contact" className="rounded-full px-3 py-2 transition hover:bg-white dark:hover:bg-slate-700 hover:text-[#078dcc]">{t('Contact us')}</a>
                        </nav>
                        <div className="flex items-center gap-2">
                            <ThemeToggle tone="light" className="hidden sm:inline-flex" />
                            <LanguageSwitcher className="hidden rounded-lg bg-[#0E3B2E] p-1 sm:inline-flex" />
                            {auth?.user ? (
                                <Link href={route('dashboard')} className="hidden rounded bg-[#08a8ec] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white sm:inline-flex sm:text-xs">{t('Dashboard')}</Link>
                            ) : (
                                <>
                                    {canLogin && <Link href={route('login')} className="hidden px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 transition hover:text-[#078dcc] sm:block">{t('Log in')}</Link>}
                                    <button type="button" onClick={() => openContactForm('rent')} className="rounded bg-[#08a8ec] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-[#0a9ee1] sm:text-xs">{t('Inquiry')}</button>
                                </>
                            )}
                            <button type="button" className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation menu">
                                {menuOpen ? <X size={17} /> : <Menu size={17} />}
                            </button>
                        </div>
                    </div>
                    {menuOpen && (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-1 text-sm md:hidden">
                            <a className="block py-3 font-medium text-slate-700 dark:text-slate-200" href="#featured">{t('Properties')}</a>
                            <a className="block py-3 font-medium text-slate-700 dark:text-slate-200" href="#cities">{t('Cities')}</a>
                            <a className="block py-3 font-medium text-slate-700 dark:text-slate-200" href="#contact">{t('Contact us')}</a>
                            {!auth?.user && canLogin && <Link href={route('login')} className="block w-full py-3 text-left font-semibold text-slate-700 dark:text-slate-200">{t('Log in')}</Link>}
                            {/* Phones: language and the light / dark switch live here, the header has no room for them. */}
                            <div className="py-3 sm:hidden">
                                <LanguageSwitcher className="rounded-lg bg-[#0E3B2E] p-1" />
                            </div>
                            <button type="button" onClick={toggleTheme} aria-pressed={dark} className="flex w-full items-center justify-between py-3 text-left font-medium text-slate-700 dark:text-slate-200 sm:hidden">
                                {t('Dark mode')}
                                {dark ? <Sun size={17} className="text-amber-300" aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
                            </button>
                            {!auth?.user && <button type="button" onClick={() => { setMenuOpen(false); openContactForm('rent'); }} className="block w-full py-3 text-left font-semibold text-[#078dcc]">{t('Inquiry')}</button>}
                        </div>
                    )}
                </header>

                <main>
                    <div className="px-4 pt-3 sm:hidden"><InstallAppBanner className="!mb-3" /></div>
                    <section className="relative h-[26rem] overflow-hidden bg-[#0e3b2e] sm:h-[31rem]">
                        {heroSlides.map((item, index) => <img key={item.image} src={item.image} alt="" fetchpriority={index === 0 ? 'high' : 'low'} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${index === slide ? 'opacity-60' : 'opacity-0'}`} />)}
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/35 to-transparent" />
                        <div className="relative mx-auto flex h-full max-w-7xl items-center px-4 pb-6 sm:px-6 lg:px-8"><div className="max-w-2xl text-white"><p className="flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-orange-400" /> {t(current.location)}</p><h1 className="mt-4 text-4xl font-light leading-tight sm:mt-5 sm:text-6xl lg:text-7xl">{t(current.title)}</h1><p className="mt-3 text-base font-medium text-white/85 sm:mt-4 sm:text-lg">{t(current.subtitle)}</p><p className="mt-4 text-xl font-bold sm:mt-6 sm:text-2xl">{t(current.price)}</p><button type="button" onClick={() => {
                            if (!current.cta) return openContactForm('rent');
                            document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-900/20 transition hover:bg-orange-600 sm:mt-8 sm:px-7 sm:py-3.5">{t(current.cta || 'Make an enquiry')} <ArrowRight size={16} /></button></div></div>
                        <div className="absolute inset-x-0 bottom-12 flex justify-center gap-2 sm:bottom-14" role="group" aria-label={t('Choose a slide')}>
                            {heroSlides.map((item, index) => (
                                <button
                                    key={item.image}
                                    type="button"
                                    onClick={() => setSlide(index)}
                                    aria-label={t(item.title)}
                                    aria-current={index === slide ? 'true' : undefined}
                                    className="flex h-6 items-center px-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                >
                                    <span className={`block h-1.5 rounded-full transition-all ${index === slide ? 'w-7 bg-orange-400' : 'w-3 bg-white/60 hover:bg-white dark:hover:bg-slate-700'}`} />
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="relative z-10 mx-auto -mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
                        <form onSubmit={submitSearch} role="search" className="grid gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.6fr)_repeat(4,minmax(140px,1fr))]">
                            <SearchSuggestBox
                                value={searchForm.search}
                                onChange={(text) => updateSearch({ search: text }, true)}
                                onSearchNow={() => applySearch(searchForm)}
                                onPickPlace={(place) => {
                                    const filters = { ...searchForm, search: '', province_id: '', district_id: '', sector_id: '', ...place.filters };
                                    setSearchForm(filters);
                                    applySearch(filters);
                                }}
                            />
                            <select value={searchForm.province_id} onChange={(event) => updateSearch({ province_id: event.target.value, district_id: '', sector_id: '' })} aria-label="Province" className="min-h-12 w-full dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:border-[#078dcc] focus:ring-2 focus:ring-[#078dcc]/20">
                                <option value="">{t('All provinces')}</option>
                                {(locations.provinces || []).map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
                            </select>
                            <select value={searchForm.district_id} onChange={(event) => updateSearch({ district_id: event.target.value, sector_id: '' })} aria-label="District" className="min-h-12 w-full dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:border-[#078dcc] focus:ring-2 focus:ring-[#078dcc]/20">
                                <option value="">{t('All districts')}</option>
                                {availableDistricts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
                            </select>
                            <select value={searchForm.sector_id} onChange={(event) => updateSearch({ sector_id: event.target.value })} aria-label="Sector" className="min-h-12 w-full dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:border-[#078dcc] focus:ring-2 focus:ring-[#078dcc]/20">
                                <option value="">{t('All sectors')}</option>
                                {availableSectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}
                            </select>
                            <select value={searchForm.price_range} onChange={(event) => updateSearch({ price_range: event.target.value })} aria-label="Rent range" className="min-h-12 w-full dark:bg-slate-900 sm:col-span-2 xl:col-span-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 focus:border-[#078dcc] focus:ring-2 focus:ring-[#078dcc]/20">
                                <option value="any">{t('Any price')}</option>
                                <option value="under-500000">{t('Under 500,000 RWF')}</option>
                                <option value="500000-1500000">500,000 - 1,500,000 RWF</option>
                                <option value="1500000-5000000">1,500,000 - 5,000,000 RWF</option>
                                <option value="5000000-plus">Over 5,000,000 RWF</option>
                            </select>
                        </form>
                    </section>

                    {searchFilters.active && (
                        <section id="search-results" className="mx-auto max-w-7xl scroll-mt-32 px-4 pt-10 sm:px-6 lg:px-8">
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600 dark:text-orange-400">{t('Search results')}</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{t(':count available :units found', { count: units.total, units: t(units.total === 1 ? 'unit' : 'units') })}</h2>
                                </div>
                                <button type="button" onClick={clearSearch} className="text-sm font-semibold text-[#064b78] dark:text-sky-300 transition hover:text-orange-600">{t('Clear filters')}</button>
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
                                <div className="mt-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-6 py-10 text-center">
                                    <Search className="mx-auto text-slate-400" size={30} />
                                    <p className="mt-3 font-semibold text-slate-800 dark:text-slate-200">{t('No matching available units')}</p>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('Try a different location, property type, or price range.')}</p>
                                </div>
                            )}
                        </section>
                    )}

                    {!searchFilters.active && (
                        <section id="featured" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
                            <div className="text-center">
                                <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600 dark:text-orange-400">{t('Available now')}</p>
                                <h2 className="mt-3 text-3xl font-light sm:text-4xl">{t('Discover Available Rental Units')}</h2>
                                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('Browse individual spaces, see their details, and contact the property owner.')}</p>
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
                                <div className="mt-7 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{t('There are no available units yet. Please check back soon.')}</div>
                            )}
                        </section>
                    )}

                    <section id="cities" className="scroll-mt-28 bg-white dark:bg-slate-900" aria-labelledby="cities-title">
                        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
                            <div className="text-center">
                                <h2 id="cities-title" className="text-3xl font-light sm:text-4xl">{t('Explore by cities')}</h2>
                                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t('Choose a city to see available listings.')}</p>
                            </div>
                            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                                {cities.map((city, index) => (
                                    <button
                                        type="button"
                                        key={city.name}
                                        onClick={() => {
                                            const filters = { ...searchForm, category: '', search: '', ...cityFilters(city, locations) };
                                            setSearchForm(filters);
                                            applySearch(filters);
                                        }}
                                        className={`group relative h-40 overflow-hidden rounded-2xl bg-[#0e3b2e] text-left shadow-sm transition hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-400 sm:h-56 lg:h-64 ${index === 0 ? 'col-span-2 lg:col-span-1' : ''}`}
                                        aria-label={t('See listings in :city', { city: city.name })}
                                    >
                                        <img src={city.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                        <div className="absolute inset-x-4 bottom-4 text-white sm:inset-x-5 sm:bottom-5">
                                            <MapPin size={20} className="text-orange-300" aria-hidden="true" />
                                            <h3 className="mt-2 text-lg font-bold sm:text-xl">{city.name}</h3>
                                            <p className="mt-1 text-xs text-white/80">{t('Browse available spaces')}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="border-t border-slate-100 dark:border-slate-800 bg-[#f6f8fa] dark:bg-slate-950">
                        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
                            <div className="text-center">
                                <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600 dark:text-orange-400">{t('Built together')}</p>
                                <h2 className="mt-3 text-3xl font-light text-slate-900 dark:text-slate-100 sm:text-4xl">{t('Our Partners')}</h2>
                                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{t('We work with trusted property owners, business communities, relocation teams, and local enterprises to make finding the right space easier.')}</p>
                            </div>
                            <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
                                {[
                                    ['Property owners', 'Quality spaces from people who know their properties best.'],
                                    ['Business communities', 'Connections that help teams find the right Kigali address.'],
                                    ['Relocation teams', 'Practical support for people moving into a new space.'],
                                    ['Local enterprises', 'Flexible solutions for growing businesses and brands.'],
                                ].map(([title, description]) => (
                                    <div key={title} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#064b78]/10 dark:bg-sky-400/10 text-[#064b78] dark:text-sky-300"><Building2 size={21} /></div>
                                        <h3 className="mt-4 font-bold text-slate-900 dark:text-slate-100">{t(title)}</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{t(description)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 text-center sm:mt-10">
                                <Link href={route('register')} className="inline-flex items-center gap-2 rounded-lg bg-[#064b78] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#053653]">{t('Become a partner')} <ArrowRight size={16} /></Link>
                            </div>
                        </div>
                    </section>
                    <ContactSection phone={companyPhone} phoneDisplay={companyPhoneDisplay} email={companyEmail} address={companyAddress} mapUrl={companyMapUrl} whatsappUrl={whatsappUrl} />
                </main>

                <footer className="relative bg-[#063f67] text-white">
                    <div className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 sm:pb-12 sm:pt-14 lg:px-8">
                        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
                            <div>
                                <BrandLockup
                                    logoClassName="h-16 w-16"
                                    nameClassName="text-lg font-black text-white"
                                    subtitleClassName="text-[9px] font-medium text-white/70"
                                />
                                <p className="mt-4 max-w-xs text-sm leading-7 text-white/65">{t('Beautiful spaces, better business, and a simpler way to rent in Rwanda.')}</p>
                                <div className="mt-6 flex gap-3">
                                    <a href={`tel:${companyPhone}`} aria-label={t('Call Ituze')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#f97316]"><Phone size={17} /></a>
                                    <a href={`mailto:info@qraltd.com`} aria-label={t('Email Ituze')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#f97316]"><Mail size={17} /></a>
                                    <a href="#contact" aria-label={t('Contact us')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#f97316]"><MessageCircle size={17} /></a>
                                </div>
                            </div>
                            <div><h3 className="text-sm font-bold uppercase tracking-wider text-[#f0a052]">{t('Explore')}</h3><div className="mt-5 space-y-3 text-sm text-white/70"><a className="block transition hover:text-white" href="#featured">{t('Featured spaces')}</a><a className="block transition hover:text-white" href="#cities">{t('Explore by cities')}</a><a className="block transition hover:text-white" href="#contact">{t('Contact us')}</a></div></div>
                            <div><h3 className="text-sm font-bold uppercase tracking-wider text-[#f0a052]">{t('For owners')}</h3><div className="mt-5 space-y-3 text-sm text-white/70"><button type="button" className="block transition hover:text-white" onClick={() => openContactForm('list')}>{t('Inquiry')}</button>{canLogin && <Link href={route('login')} className="block transition hover:text-white">{t('Owner login')}</Link>}</div></div>
                            <div><h3 className="text-sm font-bold uppercase tracking-wider text-[#f0a052]">{t('Contact us')}</h3><div className="mt-5 space-y-4 text-sm text-white/70"><a href={companyMapUrl} target="_blank" rel="noreferrer" className="flex gap-3 transition hover:text-white"><MapPin size={17} className="mt-0.5 shrink-0 text-[#f0a052]" /><span>{companyAddress}</span></a><a href={`tel:${companyPhone}`} className="flex items-center gap-3 transition hover:text-white"><Phone size={17} className="text-[#f0a052]" /> {companyPhoneDisplay}</a><a href={`mailto:info@qraltd.com`} className="flex items-center gap-3 transition hover:text-white"><Mail size={17} className="text-[#f0a052]" /> {companyEmail}</a></div></div>
                        </div>
                        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/60 lg:flex-row lg:items-center"><span>© {new Date().getFullYear()} ITUZE GREEN PLATFORM. {t('All rights reserved.')}</span><div className="flex flex-wrap items-center gap-x-5 gap-y-2"><button type="button" onClick={() => setLegalDoc('terms')} className="transition hover:text-white">{t('Terms and Conditions')}</button><button type="button" onClick={() => setLegalDoc('privacy')} className="transition hover:text-white">{t('Privacy Policy')}</button><button type="button" onClick={() => setCreditsOpen(true)} className="transition hover:text-white">{t('Photo credits')}</button><span>{t('Trusted property listings in Rwanda.')}</span></div></div>
                    </div>
                    <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label={t('Chat with Ituze on WhatsApp')} className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#25d366] text-white shadow-xl shadow-black/20 transition hover:scale-105 hover:bg-[#1fba59] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#25d366]/40 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14">
                        <MessageCircle size={27} />
                    </a>
                </footer>
            </div>
            {legalDoc && <LegalModal document={legalDoc} onClose={() => setLegalDoc(null)} />}
            {creditsOpen && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="credits-title" onClick={() => setCreditsOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setCreditsOpen(false)}>
                    <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h2 id="credits-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('Photo credits')}</h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('Photos of Rwanda from Wikimedia Commons:')}</p>
                        <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                            {[...heroSlides.map((slideItem) => ({ ...slideItem, name: t(slideItem.name) })), ...cities].map((photo) => (
                                <li key={photo.source}>
                                    <a href={photo.source} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0E3B2E] dark:text-emerald-300 underline underline-offset-2">{photo.name}</a> — {photo.credit}
                                </li>
                            ))}
                        </ul>
                        <button type="button" autoFocus onClick={() => setCreditsOpen(false)} className="mt-6 min-h-11 w-full rounded-xl bg-[#0E3B2E] text-sm font-semibold text-white hover:bg-[#124B3A] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/30">{t('Close')}</button>
                    </div>
                </div>
            )}
        </>
    );
}
