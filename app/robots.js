export default function robots() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://dutyontrack.in'
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/setup', '/superadmin'] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
