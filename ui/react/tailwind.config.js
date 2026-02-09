/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                surface: '#0b1220',
                panel: '#0f172a',
                accent: '#22d3ee',
                accentSoft: '#0ea5e9',
            },
            fontFamily: {
                display: ['"Space Grotesk"', '"Inter"', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'SFMono-Regular', 'monospace'],
            },
            boxShadow: {
                panel: '0 20px 50px -24px rgba(15, 23, 42, 0.8)',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                shimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
            },
            animation: {
                fadeIn: 'fadeIn 0.3s ease-in forwards',
                shimmer: 'shimmer 2s infinite',
            },
        },
    },
    plugins: [],
};
