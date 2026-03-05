/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'wondr-pink': '#9100BD',
                'wondr-blue': '#7a00a0',
                'wondr-lavender': '#9100BD',
                'wondr-bg': '#F8F9FA',
                'wondr-dark': '#1A1A2E',
                'pinpoint': {
                    DEFAULT: '#9100BD',
                    light: '#a855f7',
                    dark: '#7a00a0',
                    bg: '#F8F9FA',
                    'bg-alt': '#F1F3F5',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                heading: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'wondr': '12px',
            },
        },
    },
    plugins: [],
}
