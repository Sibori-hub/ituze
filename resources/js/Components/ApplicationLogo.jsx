export default function ApplicationLogo({ className = 'h-10 w-auto', ...props }) {
    return (
        <img
            src="/images/logo.png"
            alt="ITUZE GREEN PLATFORM"
            className={`object-contain rounded-full bg-white p-0.5 shadow-sm ${className}`}
            {...props}
        />
    );
}
