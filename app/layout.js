import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://dutyontrack.in'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'DutyOnTrack — India\u2019s Smart Workforce Management & Staffing SaaS',
    template: '%s · DutyOnTrack',
  },
  description:
    'DutyOnTrack is an enterprise-grade Workforce Management & Staffing SaaS for healthcare, security, housekeeping, driver and facility agencies. Manage staff, clients, duties, attendance, invoices, salary and profit from one intelligent dashboard.',
  applicationName: 'DutyOnTrack',
  keywords: [
    'Workforce Management SaaS',
    'Staffing Agency Software',
    'Placement Register',
    'Duty Management',
    'Healthcare Staffing Software',
    'Security Guard Management',
    'Housekeeping CRM',
    'Driver Staffing',
    'Facility Management SaaS',
    'Attendance Management',
    'Salary Slip Generator',
    'Multi-tenant SaaS India',
  ],
  authors: [{ name: 'DutyOnTrack' }],
  creator: 'DutyOnTrack',
  publisher: 'DutyOnTrack',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'DutyOnTrack',
    title: 'DutyOnTrack — India\u2019s Smart Workforce Management SaaS',
    description: 'Multi-tenant staffing SaaS with placement register, auto profit calculation, attendance, invoices and live P&L dashboards.',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DutyOnTrack — Smart Workforce Management SaaS',
    description: 'Manage staff, clients, duties, attendance, billing and profit from one intelligent dashboard.',
    creator: '@dutyontrack',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  category: 'business',
}

export const viewport = {
  themeColor: '#050914',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#organization`,
      name: 'DutyOnTrack',
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'DutyOnTrack',
      publisher: { '@id': `${SITE_URL}#organization` },
      inLanguage: 'en-IN',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'DutyOnTrack',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android (PWA), iOS (PWA)',
      description: 'Multi-tenant workforce & staffing SaaS: placement register, auto profit, attendance, invoices, salary, P&L.',
      offers: [
        { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'INR' },
        { '@type': 'Offer', name: 'Starter', price: '499', priceCurrency: 'INR' },
        { '@type': 'Offer', name: 'Professional', price: '1499', priceCurrency: 'INR' },
        { '@type': 'Offer', name: 'Enterprise', price: '4999', priceCurrency: 'INR' },
      ],
      aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '124' },
    },
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);',
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
