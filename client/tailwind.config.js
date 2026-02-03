/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'wondr-pink': '#FF5BA3',
                'wondr-blue': '#0000EE',
                'wondr-lavender': '#E6E0FF',
                'wondr-bg': '#FAFAFA',
                'wondr-dark': '#1A1A2E',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                heading: ['Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'wondr': '16px',
            },
        },
    },
    plugins: [],
}
