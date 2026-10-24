import BrandLockup from '@/Components/BrandLockup';
import ChatWidget, { openChat } from '@/Components/ChatWidget';
import Dropdown from '@/Components/Dropdown';
import FlashToast from '@/Components/FlashToast';
import InstallAppBanner, { isStandalone, promptInstall } from '@/Components/InstallAppBanner';
import InlineAlert from '@/Components/InlineAlert';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import SuccessModal from '@/Components/SuccessModal';
import UserAvatar from '@/Components/UserAvatar';
import { Link, usePage } from '@inertiajs/react';
import { useCallback, useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Building2,
    Users as UsersIcon,
    FileText,
    CreditCard,
    MessageSquare,
    Phone,
    Mail,
    BarChart3,
    ShieldCheck,
    Menu,
    X,
    Bell,
    ChevronDown,
    ChevronRight,
    Eye,
    UserCog,
    Briefcase,
    Wallet,
    Newspaper,
    Inbox,
    MessagesSquare,
    AlertTriangle,
    Leaf,
} from 'lucide-react';
import { useTranslation } from '@/localization';

const ownerNavigation = [
    { name: 'Dashboard', href: 'dashboard', icon: LayoutDashboard },
    { name: 'Properties', href: 'properties.index', icon: Building2 },
    { name: 'Tenants', href: 'tenants.index', icon: UsersIcon },
    { name: 'Leases', href: 'leases.index', icon: FileText },
    { name: 'Payments', href: 'payments.index', icon: CreditCard },
    { name: 'Visitor inquiries', href: 'dashboard', anchor: '#visitor-inquiries', icon: MessageSquare },
    { name: 'Reports', href: 'reports.index', icon: BarChart3 },
    { name: 'Utilities', href: 'utilities.index', icon: Leaf },
];

const advertiserNavigation = [
    { name: 'Listings', href: 'dashboard', icon: LayoutDashboard },
    { name: 'My buildings', href: 'properties.index', icon: Building2 },
    { name: 'Visitor inquiries', href: 'dashboard', anchor: '#ad-inquiries', icon: MessageSquare },
];

const adminNavigation = [
    { name: 'Dashboard', href: 'dashboard', icon: LayoutDashboard },
    { name: 'Approvals', href: 'admin.approvals', icon: ShieldCheck },
    { name: 'Subscriptions', href: 'admin.subscriptions', icon: Wallet },
    { name: 'Chats', href: 'admin.chats', icon: MessagesSquare, badge: 'unreadChats' },
    { name: 'Messages', href: 'admin.messages', icon: Inbox, badge: 'newMessages' },
    { name: 'Newsletter', href: 'admin.newsletter', icon: Newspaper },
    { name: 'All Users', href: 'admin.users', icon: UsersIcon },
    { name: 'Properties', href: 'properties.index', icon: Building2 },
    { name: 'Tenants', href: 'tenants.index', icon: UsersIcon },
    { name: 'Leases', href: 'leases.index', icon: FileText },
    { name: 'Payments', href: 'payments.index', icon: CreditCard },
    { name: 'Visitor inquiries', href: 'dashboard', anchor: '#visitor-inquiries', icon: MessageSquare },
    { name: 'Reports', href: 'reports.index', icon: BarChart3 },
    { name: 'Utilities', href: 'utilities.index', icon: Leaf },
];

const ROLE_LABELS = { admin: 'Administrator', owner: 'Property Owner', advertiser: 'Advertiser', manager: 'Manager' };

export default function AuthenticatedLayout({ header, children }) {
    const page = usePage();
    const pageProps = page.props;
    const user = pageProps.auth.user;
    const flash = pageProps.flash || {};
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [successModal, setSuccessModal] = useState(null);
    const { t } = useTranslation();

    const navigation =
        user.role === 'admin'
            ? adminNavigation
            : user.role === 'advertiser'
              // Buildings open once the advertiser has paid for a first listing.
              ? advertiserNavigation.filter((item) => pageProps.auth.advertiserPaid || item.href !== 'properties.index')
              : pageProps.auth.canHireManagers
                ? [...ownerNavigation, { name: 'Managers', href: 'managers.index', icon: UserCog }, { name: 'Subscription', href: 'subscription.show', icon: Wallet }]
                : ownerNavigation;

    useEffect(() => {
        // Success messages get the success dialog instead of a toast.
        const order = ['error', 'warning', 'info', 'status'];
        const newToasts = [];
        order.forEach((type, i) => {
            const msg = flash[type];
            if (msg) {
                const toastType = type === 'status' ? 'info' : type;
                newToasts.push({ id: `${type}-${Date.now()}-${i}`, type: toastType, message: msg });
            }
        });
        if (newToasts.length) setToasts(prev => [...prev, ...newToasts]);
        if (flash.success) setSuccessModal(flash.success);
    }, [flash]);

    const closeSuccess = useCallback(() => setSuccessModal(null), []);

    const dismissToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div
            className="authenticated-app-shell flex w-full flex-col overflow-hidden bg-[#F4F6F5] font-[Inter]"
            style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', width: '100vw', height: '100dvh' }}
        >
            {toasts.length > 0 && (
                <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
                    {toasts.map(t => (
                        <FlashToast
                            key={t.id}
                            type={t.type}
                            message={t.message}
                            onClose={() => dismissToast(t.id)}
                        />
                    ))}
                </div>
            )}
            <SuccessModal message={successModal} onClose={closeSuccess} />

            <div className="authenticated-layout-row flex min-h-0 flex-1" style={{ display: 'flex', flex: '1 1 0%', minHeight: 0 }}>
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside
                    className={`authenticated-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden transform bg-[#0E3B2E] transition-transform duration-300 ease-out lg:static lg:h-full lg:shrink-0 lg:translate-x-0 ${
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <div className="flex h-16 shrink-0 items-center justify-between px-6">
                        <Link href="/" className="rounded-xl">
                            <BrandLockup
                                logoClassName="h-12 w-12"
                                nameClassName="text-xs font-bold text-white"
                                subtitleClassName="text-[8px] font-medium text-white/70"
                            />
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden text-white/60 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {user.role === 'admin' && (
                        <div className="mx-4 mt-3 shrink-0 rounded-lg bg-[#D9A441]/10 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#D9A441]">
                            Admin Access
                        </div>
                    )}

                    <nav className="authenticated-sidebar-nav flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-4 pt-4">
                        {navigation.map((item) => {
                            // Links that jump to a section of another page (an anchor) never
                            // compete with that page's own entry for the active state.
                            const isActive = route().current(item.href) && !item.anchor;
                            const className = `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                                isActive
                                    ? 'bg-[#D9A441] text-[#0E3B2E] shadow-sm'
                                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                            }`;
                            const content = (
                                <>
                                    <item.icon
                                        size={18}
                                        className={
                                            isActive
                                                ? 'text-[#0E3B2E]'
                                                : 'text-white/50 group-hover:text-white'
                                        }
                                    />
                                    {t(item.name)}
                                    {item.badge && pageProps.auth[item.badge] > 0 && (
                                        <span className="ml-auto min-w-[1.375rem] rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 text-white">
                                            {pageProps.auth[item.badge]}
                                            <span className="sr-only"> {t('new')}</span>
                                        </span>
                                    )}
                                </>
                            );
                            return (
                                <Link
                                    key={item.name}
                                    href={`${route(item.href)}${item.anchor || ''}`}
                                    onClick={() => setSidebarOpen(false)}
                                    className={className}
                                >
                                    {content}
                                </Link>
                            );
                        })}
                    </nav>

                    <Link
                        href={route('profile.edit')}
                        onClick={() => setSidebarOpen(false)}
                        className="group mx-3 mb-3 mt-2 flex shrink-0 items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                    >
                        <UserAvatar user={user} size="sm" className="ring-2 ring-[#D9A441]/60" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
                            <span className="block truncate text-[11px] text-white/50">{t(ROLE_LABELS[user.role] ?? 'Property Owner')}</span>
                        </span>
                        <ChevronRight size={15} className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/80" />
                    </Link>
                </aside>

                {/* Main content area */}
                <div className="authenticated-main-column flex min-h-0 min-w-0 flex-1 flex-col" style={{ display: 'flex', flex: '1 1 0%', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                    {/* Top bar */}
                    <header className="authenticated-main-header z-30 flex h-16 shrink-0 items-center justify-between bg-[#0E3B2E] px-4 sm:px-6" style={{ flexShrink: 0 }}>
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="text-white/60 hover:text-white lg:hidden"
                            >
                                <Menu size={22} />
                            </button>
                            {header && (
                                <h1 className="hidden truncate font-[Sora] text-lg font-semibold text-white sm:block">
                                    {t(header)}
                                </h1>
                            )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                            <LanguageSwitcher />

                            {user.role !== 'advertiser' && (
                                <Link
                                    href={`${route('dashboard')}#visitor-inquiries`}
                                    className="rounded-full p-2 text-white/60 transition hover:bg-white/5 hover:text-white"
                                    aria-label={t('Visitor inquiries')}
                                    title={t('Visitor inquiries')}
                                >
                                    <Bell size={18} />
                                </Link>
                            )}

                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button className="flex items-center gap-2 rounded-full bg-white/5 p-1 text-sm sm:pr-3 font-medium text-white/90 transition hover:bg-white/10">
                                        <UserAvatar user={user} size="xs" className="h-8 w-8 ring-2 ring-[#D9A441]/70" />
                                        <span className="hidden max-w-[10rem] truncate sm:inline">
                                            {user.first_name || user.name}
                                        </span>
                                        <ChevronDown size={14} className="hidden sm:block" />
                                    </button>
                                </Dropdown.Trigger>

                                <Dropdown.Content width="60">
                                    <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                                        <UserAvatar user={user} size="md" />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
                                            <p className="truncate text-xs text-gray-500">{user.email}</p>
                                        </div>
                                    </div>
                                    <Dropdown.Link
                                        href={route('profile.edit')}
                                    >
                                        {t('Profile')}
                                    </Dropdown.Link>
                                    {!isStandalone() && (
                                        <button type="button" onClick={async () => { if (!(await promptInstall())) window.dispatchEvent(new Event('ituze:show-install')); }}
                                            className="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 transition hover:bg-gray-100 focus:bg-gray-100 focus:outline-none">
                                            {t('Install app')}
                                        </button>
                                    )}
                                    <Dropdown.Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                    >
                                        {t('Log Out')}
                                    </Dropdown.Link>
                                </Dropdown.Content>
                            </Dropdown>
                        </div>
                    </header>

                    {/* Page content */}
                    <main className="authenticated-page-content flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain scroll-smooth" style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto' }}>
                        <div className="flex-1 p-4 sm:p-6">
                        <InstallAppBanner />
                        {pageProps.auth.subscription && !pageProps.auth.subscription.paid_until && !route().current('subscription.show') && (
                            <div className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="status">
                                <Building2 size={18} className="shrink-0 text-emerald-700" aria-hidden="true" />
                                <p className="min-w-0 flex-1">
                                    <span className="font-semibold">{t('Welcome to ITUZE!')}</span>{' '}
                                    {t('To add your properties, pay for the houses you need: :price per house per month. Pay for 10 houses and you can add 10 properties.', { price: '100,000 RWF' })}
                                </p>
                                <Link href={route('subscription.show')} className="rounded-xl bg-[#0E3B2E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#124B3A]">{t('Pay for houses')}</Link>
                            </div>
                        )}
                        {pageProps.auth.subscription && (pageProps.auth.subscription.in_grace || (pageProps.auth.subscription.days_left !== null && pageProps.auth.subscription.days_left <= 7)) && !route().current('subscription.show') && (
                            <div className={`mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${pageProps.auth.subscription.in_grace ? 'border-red-200 bg-red-50 text-red-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`} role="status">
                                <AlertTriangle size={18} className={`shrink-0 ${pageProps.auth.subscription.in_grace ? 'text-red-700' : 'text-amber-700'}`} aria-hidden="true" />
                                <p className="min-w-0 flex-1">
                                    {pageProps.auth.subscription.in_grace
                                        ? t('Your subscription has ended. Pay before :date or your account and managers will be paused.', { date: new Date(pageProps.auth.subscription.grace_ends_at).toLocaleDateString() })
                                        : t('Your subscription ends in :days days. Pay now to keep everything running.', { days: Math.max(0, pageProps.auth.subscription.days_left) })}
                                </p>
                                <Link href={route('subscription.show')} className="rounded-xl bg-[#0E3B2E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#124B3A]">{t('Pay now')}</Link>
                            </div>
                        )}
                        {user.role === 'manager' && pageProps.auth.employer && (
                            <div className="mx-auto mb-4 flex max-w-7xl items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="note">
                                <Briefcase size={18} className="shrink-0 text-emerald-700" aria-hidden="true" />
                                <p>{t('You manage buildings for :owner. You only see the properties and units they gave you.', { owner: pageProps.auth.employer.name })}</p>
                            </div>
                        )}
                        {pageProps.auth.readOnly && (
                            <div className="mx-auto mb-4 flex max-w-7xl items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950" role="note">
                                <Eye size={18} className="mt-0.5 shrink-0 text-sky-700" aria-hidden="true" />
                                <p>
                                    <span className="font-semibold">{t('View-only account.')}</span>{' '}
                                    {t('ITUZE GREEN PLATFORM manages your properties. You can follow everything here; please contact us for any change.')}
                                </p>
                            </div>
                        )}
                        {flash.error && (
                            <div className="mb-4 max-w-7xl mx-auto">
                                <InlineAlert message={flash.error} type="error" />
                            </div>
                        )}
                        {flash.warning && (
                            <div className="mb-4 max-w-7xl mx-auto">
                                <InlineAlert message={flash.warning} type="warning" />
                            </div>
                        )}
                        {flash.info && (
                            <div className="mb-4 max-w-7xl mx-auto">
                                <InlineAlert message={flash.info} type="info" />
                            </div>
                        )}
                        <div key={page.url.split('#')[0]} className="animate-fade-up motion-reduce:animate-none">
                            {children}
                        </div>
                        </div>

                        <footer className="authenticated-main-footer mt-8 border-t border-gray-200 bg-white">
                            <div className="h-1 bg-gradient-to-r from-[#0E3B2E] via-emerald-500 to-[#D9A441]" aria-hidden="true" />
                            <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr]">
                                <div>
                                    <BrandLockup logoClassName="h-11 w-11" nameClassName="text-sm font-black text-[#0E3B2E]" subtitleClassName="text-[9px] font-semibold text-gray-500" />
                                    <p className="mt-3 max-w-xs text-sm leading-6 text-gray-600">
                                        {t('Buildings, tenants, leases and rent in one place. Simple, safe and in your language.')}
                                    </p>
                                </div>

                                <div>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#0E3B2E]">{t('Need help?')}</h2>
                                    <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                        {user.role !== 'admin' && (
                                            <li>
                                                <button type="button" onClick={openChat} className="inline-flex items-center gap-2 font-semibold text-[#0E3B2E] hover:underline">
                                                    <MessageSquare size={15} aria-hidden="true" /> {t('Chat with us')}
                                                </button>
                                            </li>
                                        )}
                                        <li>
                                            <a href="tel:+250793905166" className="inline-flex items-center gap-2 hover:text-[#0E3B2E] hover:underline">
                                                <Phone size={15} className="text-gray-400" aria-hidden="true" /> 0793 905 166
                                            </a>
                                        </li>
                                        <li>
                                            <a href="mailto:info@qraltd.com" className="inline-flex items-center gap-2 hover:text-[#0E3B2E] hover:underline">
                                                <Mail size={15} className="text-gray-400" aria-hidden="true" /> info@qraltd.com
                                            </a>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#0E3B2E]">{t('ITUZE')}</h2>
                                    <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                        <li><Link href="/" className="hover:text-[#0E3B2E] hover:underline">{t('Public website')}</Link></li>
                                        <li><Link href={route('legal.terms')} className="hover:text-[#0E3B2E] hover:underline">{t('Terms and Conditions')}</Link></li>
                                        <li><Link href={route('legal.privacy')} className="hover:text-[#0E3B2E] hover:underline">{t('Privacy Policy')}</Link></li>
                                    </ul>
                                </div>
                            </div>
                            {/* Bottom line; on phones it leaves room for the chat button. */}
                            <div className={`border-t border-gray-100 bg-gray-50/80 ${user.role !== 'admin' ? 'pb-20 sm:pb-0' : ''}`}>
                                <p className={`mx-auto max-w-7xl px-4 py-3 text-xs text-gray-500 sm:px-6 ${user.role !== 'admin' ? 'sm:pr-56' : ''}`}>
                                    © {new Date().getFullYear()} <span className="font-semibold text-[#0E3B2E]">ITUZE GREEN PLATFORM</span>
                                    <span aria-hidden="true"> · </span>
                                    {t('Powered by Q.R.A GROUP LTD')}. {t('All rights reserved.')}
                                </p>
                            </div>
                        </footer>
                    </main>
                </div>
            </div>
            {user.role !== 'admin' && <ChatWidget />}
        </div>
    );
}