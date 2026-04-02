/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Fonds DLS ── */
        'dls-base':     '#07080F',
        'dls-card':     '#0F1020',
        'dls-elevated': '#161830',

        /* ── Accents ── */
        'dls-blue':    '#1155CC',
        'dls-blue-h':  '#1460E8',
        'dls-violet':  '#5B1DB0',
        'dls-crimson': '#A80B1C',
        'dls-gold':    '#F5A623',
        'dls-green':   '#16A34A',

        /* ── Texte ── */
        'dls-text':    '#FFFFFF',
        'dls-sub':     '#94A3B8',
        'dls-muted':   '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'dls-hero':   'linear-gradient(135deg, #07080F 0%, #1A0A35 30%, #3D0D5C 50%, #5C0A18 70%, #07080F 100%)',
        'dls-blue-g': 'linear-gradient(135deg, #1155CC 0%, #1460E8 100%)',
        'dls-gold-g': 'linear-gradient(135deg, #F5A623 0%, #E8920F 100%)',
      },
      boxShadow: {
        'dls-card': '0 4px 24px rgba(0,0,0,0.4)',
        'dls-glow': '0 0 20px rgba(17,85,204,0.3)',
        'dls-gold': '0 0 20px rgba(245,166,35,0.3)',
      },
      borderColor: {
        'dls': 'rgba(91,29,176,0.25)',
        'dls-subtle': 'rgba(255,255,255,0.06)',
      },
      animation: {
        'dls-pulse': 'dlsPulse 1.5s ease-in-out infinite',
        'dls-spin':  'spin 0.8s linear infinite',
        'fade-in':   'fadeIn 0.4s ease-out',
        'slide-up':  'slideUp 0.3s ease-out',
      },
      keyframes: {
        dlsPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':       { opacity: '0.5', transform: 'scale(1.3)' },
        },
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
