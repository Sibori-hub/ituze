import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmActionModal from '@/Components/ConfirmActionModal';
import { Head, router, usePage } from '@inertiajs/react';
import { CheckCircle2, XCircle, IdCard, MapPin, Eye, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

function ProfileModal({ user, onClose, onApprove, onReject }) {
    const { t } = useTranslation();

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        const previousOverflow = window.document.body.style.overflow;
        window.document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    const details = [
        ['Email', user.email],
        ['Phone', user.phone],
        [user.identity_document_type === 'passport' ? 'Passport number' : 'NIDA number', user.national_id],
        ['Address', user.address],
        ['Province', user.sector?.district?.province?.name],
        ['District', user.sector?.district?.name],
        ['Sector', user.sector?.name],
        [
            'Registered',
            user.created_at &&
                new Date(user.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                }),
        ],
    ].filter(([, value]) => Boolean(value));

    return (
        <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="applicant-profile-title"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-start justify-between gap-4 bg-[#0E3B2E] px-5 py-4 sm:px-6">
                    <div>
                        <h2 id="applicant-profile-title" className="font-[Sora] text-lg font-semibold text-white">
                            {t('Applicant profile')}
                        </h2>
                        <p className="mt-1 text-[11px] text-white/60">
                            {t('Everything submitted during registration.')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        autoFocus
                        aria-label={t('Close')}
                        className="shrink-0 rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
                    <div className="flex items-center gap-4">
                        {user.profile_photo ? (
                            <img
                                src={`/storage/${user.profile_photo}`}
                                alt={user.name}
                                className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-[#0E3B2E]/10"
                            />
                        ) : (
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#0E3B2E]/10 font-[Sora] text-2xl font-semibold text-[#0E3B2E]">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="font-[Sora] text-lg font-semibold text-gray-800">{user.name}</p>
                            <span className="mt-1 inline-block rounded-full bg-[#D9A441]/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#8a651c]">
                                {t(user.role)}
                            </span>
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-green-700">
                                <CheckCircle2 size={13} />
                                {t('Email verified · Profile complete')}
                            </p>
                        </div>
                    </div>

                    <dl className="mt-6 border-t border-gray-100">
                        {details.map(([label, value]) => (
                            <div
                                key={label}
                                className="flex items-start justify-between gap-4 border-b border-gray-100 py-2.5 text-sm"
                            >
                                <dt className="shrink-0 text-gray-500">{t(label)}</dt>
                                <dd className="text-right font-medium text-gray-800">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <footer className="flex gap-3 border-t border-black/5 bg-gray-50 px-5 py-4 sm:px-6">
                    <button
                        type="button"
                        onClick={onReject}
                        className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                        {t('Reject')}
                    </button>
                    <button
                        type="button"
                        onClick={onApprove}
                        className="flex-1 rounded-xl bg-[#0E3B2E] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a2e23]"
                    >
                        {t('Approve')}
                    </button>
                </footer>
            </div>
        </div>
    );
}

export default function Approvals({ pendingUsers }) {
    const { t } = useTranslation();
    const { flash } = usePage().props;
    const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve'|'reject', user }
    const [processing, setProcessing] = useState(false);
    const [profileUser, setProfileUser] = useState(null);

    const openConfirm = (type, user) => setConfirmAction({ type, user });
    const closeConfirm = () => {
        if (!processing) setConfirmAction(null);
    };

    const runAction = () => {
        if (!confirmAction) return;
        setProcessing(true);

        const routeName =
            confirmAction.type === 'approve'
                ? 'admin.approvals.approve'
                : 'admin.approvals.reject';

        router.post(
            route(routeName, confirmAction.user.id),
            confirmAction.type === 'approve' ? { payment_verified: true } : {},
            {
                onFinish: () => {
                    setProcessing(false);
                    setConfirmAction(null);
                },
            },
        );
    };

    return (
        <AuthenticatedLayout header="Approvals">
            <Head title={t('Approvals')} />

            {flash?.status && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
                    {flash.status}
                </div>
            )}

            {pendingUsers.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                    <p className="text-sm text-gray-500">
                        {t('No accounts waiting for approval right now.')}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {pendingUsers.map((user) => (
                        <div
                            key={user.id}
                            className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex items-center gap-4">
                                {user.profile_photo ? (
                                    <img
                                        src={`/storage/${user.profile_photo}`}
                                        alt={user.name}
                                        className="h-14 w-14 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0E3B2E]/10 font-[Sora] font-semibold text-[#0E3B2E]">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-[Sora] font-semibold text-gray-800">{user.name}</p>
                                        <span className="rounded-full bg-[#D9A441]/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#8a651c]">
                                            {t(user.role)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {user.email} · {user.phone}
                                    </p>
                                    <p className="mt-1 text-xs font-medium text-green-700">
                                        {t('Email verified · Profile complete')}
                                    </p>
                                    {user.address && (
                                        <p className="mt-1 text-xs text-gray-500">
                                            {t('Address')}: {user.address}
                                        </p>
                                    )}
                                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <IdCard size={13} />
                                            {t(user.identity_document_type === 'passport' ? 'Passport' : 'NIDA')}: {user.national_id}
                                        </span>
                                        {user.sector && (
                                            <span className="flex items-center gap-1">
                                                <MapPin size={13} />
                                                {user.sector.name},{' '}
                                                {user.sector.district?.name},{' '}
                                                {
                                                    user.sector.district
                                                        ?.province?.name
                                                }
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setProfileUser(user)}
                                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                >
                                    <Eye size={16} />
                                    {t('View full profile')}
                                </button>
                                <button
                                    onClick={() => openConfirm('approve', user)}
                                    className="flex items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23]"
                                >
                                    <CheckCircle2 size={16} />
                                    {t('Approve')}
                                </button>
                                <button
                                    onClick={() => openConfirm('reject', user)}
                                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                                >
                                    <XCircle size={16} />
                                    {t('Reject')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmActionModal
                open={!!confirmAction}
                title={t(
                    confirmAction?.type === 'approve'
                        ? 'Approve this account?'
                        : 'Reject this account?',
                )}
                message={
                    confirmAction
                        ? confirmAction.type === 'approve'
                            ? confirmAction.user.role === 'advertiser'
                                ? t('Confirm that payment was verified outside the app. :name will then be approved as an advertiser.', { name: confirmAction.user.name })
                                : t('Confirm that payment was verified outside the app. :name will then be approved, and their one-year subscription will start today.', { name: confirmAction.user.name })
                            : t(':name will not be able to access the dashboard. You can reconsider this later.', { name: confirmAction.user.name })
                        : ''
                }
                confirmLabel={
                    t(confirmAction?.type === 'approve' ? 'Yes, Approve' : 'Yes, Reject')
                }
                tone={confirmAction?.type === 'reject' ? 'danger' : 'default'}
                processing={processing}
                onConfirm={runAction}
                onCancel={closeConfirm}
            />

            {profileUser && (
                <ProfileModal
                    user={profileUser}
                    onClose={() => setProfileUser(null)}
                    onApprove={() => {
                        setProfileUser(null);
                        openConfirm('approve', profileUser);
                    }}
                    onReject={() => {
                        setProfileUser(null);
                        openConfirm('reject', profileUser);
                    }}
                />
            )}
        </AuthenticatedLayout>
    );
}