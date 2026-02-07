export default {
    plugins: {
        '@tailwindcss/postcss': {
            // Ensure Tailwind sees our theme and scans TSX/HTML sources.
            config: './tailwind.config.js',
            sources: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
        },
        autoprefixer: {},
    },
};
