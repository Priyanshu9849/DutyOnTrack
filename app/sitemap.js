export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://dutyontrack.in'
  const now = new Date()
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/#features`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/#industries`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/#pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/#testimonials`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/#faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/#screenshots`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ]
}
