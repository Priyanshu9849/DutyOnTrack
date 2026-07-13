export default function manifest() {
  return {
    name: 'DutyOnTrack — Smart Workforce Management SaaS',
    short_name: 'DutyOnTrack',
    description: 'India\u2019s smart workforce management platform for staffing agencies. Manage staff, clients, duties, attendance, billing and profit from one intelligent dashboard.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#050914',
    theme_color: '#6366F1',
    categories: ['business', 'productivity', 'utilities'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  }
}
