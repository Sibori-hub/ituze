export default function BrandLockup({
    className = '',
    logoClassName = 'h-12 w-12',
    nameClassName = 'text-sm font-bold',
    subtitleClassName = 'text-[9px] font-medium opacity-75',
}) {
    return (
        <span className={`flex min-w-0 items-center gap-3 ${className}`}>
            <img
                src="/images/logo.png"
                alt="ITUZE GREEN PLATFORM logo"
                className={`shrink-0 object-contain ${logoClassName}`}
            />
            <span className="min-w-0">
                <span className={`block font-[Sora] leading-tight tracking-tight ${nameClassName}`}>
                    ITUZE GREEN PLATFORM
                </span>
                <span className={`mt-1 block leading-tight ${subtitleClassName}`}>
                    Powered by Q.R.A GROUP LTD
                </span>
            </span>
        </span>
    );
}
