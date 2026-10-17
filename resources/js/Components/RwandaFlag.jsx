// Drawn as SVG because flag emoji do not render on Windows.
// Proportions follow the national flag: blue half, then yellow and green quarters,
// with the golden sun of 24 rays in the upper fly corner.
const SUN = { cx: 900, cy: 180, inner: 66, outer: 126, rays: 24 };

const rayPoints = Array.from({ length: SUN.rays }, (_, i) => {
    const step = (Math.PI * 2) / SUN.rays;
    const angle = i * step - Math.PI / 2;
    const point = (a, r) => `${SUN.cx + r * Math.cos(a)},${SUN.cy + r * Math.sin(a)}`;

    return [
        point(angle - step / 2, SUN.inner),
        point(angle, SUN.outer),
        point(angle + step / 2, SUN.inner),
    ].join(' ');
});

export default function RwandaFlag({ className = 'h-4 w-6', title = 'Rwanda' }) {
    return (
        <svg
            viewBox="0 0 1080 720"
            className={`shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] ${className}`}
            role="img"
            aria-label={title}
        >
            <rect width="1080" height="360" fill="#00A1DE" />
            <rect y="360" width="1080" height="180" fill="#FAD201" />
            <rect y="540" width="1080" height="180" fill="#20603D" />
            {rayPoints.map((points) => (
                <polygon key={points} points={points} fill="#E5BE01" />
            ))}
            <circle cx={SUN.cx} cy={SUN.cy} r="60" fill="#E5BE01" stroke="#00A1DE" strokeWidth="8" />
        </svg>
    );
}
