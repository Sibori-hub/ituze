import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
            keyframes: {
                shake: {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '20%, 60%': { transform: 'translateX(-6px)' },
                    '40%, 80%': { transform: 'translateX(6px)' },
                },
                'pop-in': {
                    '0%': { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'fade-out': {
                    '0%': { opacity: '1' },
                    '100%': { opacity: '0' },
                },
                'pop-out': {
                    '0%': { opacity: '1', transform: 'scale(1)' },
                    '100%': { opacity: '0', transform: 'translateY(6px) scale(0.96)' },
                },
                countdown: {
                    '0%': { transform: 'scaleX(1)' },
                    '100%': { transform: 'scaleX(0)' },
                },
                // Ends on transform: none so the wrapper never becomes the containing
                // block for position: fixed dialogs inside the page.
                'fade-up': {
                    '0%': { opacity: '0', transform: 'translateY(6px)' },
                    '100%': { opacity: '1', transform: 'none' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.2s ease-out',
                'fade-out': 'fade-out 0.18s ease-in forwards',
                'pop-out': 'pop-out 0.18s ease-in forwards',
                countdown: 'countdown 4s linear forwards',
                // No fill mode: a finished animation must not keep the wrapper as the
                // containing block of position: fixed dialogs (Chrome does while it is filled).
                'fade-up': 'fade-up 0.35s ease-out',
                shake: 'shake 0.4s ease-in-out',
                'pop-in': 'pop-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            },
        },
    },

    plugins: [forms],
};
