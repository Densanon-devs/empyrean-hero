/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        empyrean: {
          gold: '#D4AF37',
          navy: '#1B2A4A',
          navyDark: '#0d1829',
          crimson: '#8B1A1A',
          sky: '#87CEEB',
          ash: '#C8C8C8',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,175,55,0.3)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.7), 0 0 0 2px rgba(212,175,55,0.7)',
        glow: '0 0 16px rgba(212,175,55,0.6)',
      },
      animation: {
        'card-flip': 'cardFlip 0.4s ease-in-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        cardFlip: {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
