import RwandaFlag from '@/Components/RwandaFlag';
import VerificationDialog, { DevCodeButton, HEADER_BUTTON_CLASS } from '@/Components/VerificationDialog';
import { Link } from '@inertiajs/react';
import { ArrowLeft, ExternalLink, KeyRound, Mail } from 'lucide-react';
import { useTranslation } from '@/localization';

export default function VerifyLoginOtp({ destinations = [], expiresIn, status, devMode, devOtp }) {
    const { t } = useTranslation();
    const both = destinations.length > 1;

    return (
        <VerificationDialog
            pageTitle={t('Confirm your sign in')}
            title={t('Confirm your sign in')}
            description={both ? t('We sent the same 6-digit code to your email and WhatsApp. Use whichever arrives first.') : t('We sent a 6-digit code to')}
            destination={
                <span className="mt-2 flex flex-col items-center gap-1.5">
                    {destinations.map(({ channel, value }) => (
                        <span key={channel} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm ring-1 ring-inset ring-gray-200">
                            {channel === 'whatsapp' ? <RwandaFlag className="h-3 w-[18px]" /> : <Mail size={14} className="text-[#1F7A5A]" />}
                            {value}
                        </span>
                    ))}
                </span>
            }
            Icon={KeyRound}
            verifyRoute={route('login.otp.verify')}
            resendRoute={route('login.otp.resend')}
            submitLabel={t('Confirm and sign in')}
            statusMessage={status ? t(status) : null}
            expiresIn={expiresIn}
            tip={t("Can't find it? Check your spam folder, or open WhatsApp on your phone.")}
            headerAction={
                <Link
                    href={route('login')}
                    className={HEADER_BUTTON_CLASS}
                >
                    <ArrowLeft size={15} aria-hidden="true" />
                    {t('Back to sign in')}
                </Link>
            }
            devPanel={
                devMode
                    ? (verify) => (
                          <>
                              <DevCodeButton code={devOtp} onUse={verify} />
                              <a
                                  href="http://127.0.0.1:8025"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 transition hover:ring-amber-400"
                              >
                                  <ExternalLink size={13} />
                                  {t('Open Mailpit inbox')}
                              </a>
                          </>
                      )
                    : null
            }
        />
    );
}
