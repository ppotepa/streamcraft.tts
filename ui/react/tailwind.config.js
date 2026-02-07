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
        },
    },
    plugins: [],
};
