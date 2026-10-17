import VerificationDialog, { DevCodeButton } from '@/Components/VerificationDialog';
import { useForm, usePage } from '@inertiajs/react';
import { ExternalLink, MailCheck, Zap } from 'lucide-react';
import { useTranslation } from '@/localization';

export default function VerifyEmail({ status, expiresIn, devMode, devOtp }) {
    const { t } = useTranslation();
    const { auth } = usePage().props;
    const devForm = useForm({});

    const statusMessage =
        status === 'verification-link-sent'
            ? t('A new code has been sent to :email.', { email: auth.user.email })
            : status === 'code-refreshed'
              ? t('Your previous code had expired, so we sent you a new one.')
              : null;

    return (
        <VerificationDialog
            pageTitle={t('Verify Your Email')}
            title={t('Check your email')}
            description={t('Enter the 6-digit code we sent to')}
            destination={auth.user.email}
            Icon={MailCheck}
            steps={[
                { label: t('Account'), state: 'done' },
                { label: t('Email'), state: 'current' },
                { label: 'WhatsApp', state: 'next' },
            ]}
            verifyRoute={route('verification.otp.verify')}
            resendRoute={route('verification.send')}
            submitLabel={t('Verify email')}
            statusMessage={statusMessage}
            expiresIn={expiresIn}
            tip={t("Can't find it? Check your spam or promotions folder.")}
            devPanel={
                devMode
                    ? (verify) => (
                          <>
                              <DevCodeButton code={devOtp} onUse={verify} />
                              <div className="flex gap-2">
                                  <a
                                      href="http://127.0.0.1:8025"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 transition hover:ring-amber-400"
                                  >
                                      <ExternalLink size={13} />
                                      {t('Open Mailpit inbox')}
                                  </a>
                                  <button
                                      type="button"
                                      onClick={() => devForm.post(route('dev.verify-email'))}
                                      disabled={devForm.processing}
                                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-500 disabled:opacity-60"
                                  >
                                      <Zap size={13} />
                                      {t('Dev: Verify Instantly')}
                                  </button>
                              </div>
                          </>
                      )
                    : null
            }
        />
    );
}
