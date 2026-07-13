import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'DutyOnTrack — Smart Workforce Management & Staffing SaaS',
  description:
    'DutyOnTrack is an enterprise-grade Workforce Management & Staffing SaaS. Replace manual registers with a real-time digital placement register, automated profit tracking, staff, client and vendor management.',
  keywords: ['Workforce Management', 'Staffing SaaS', 'Placement Register', 'Duty Management', 'Healthcare Staffing', 'Security Staffing'],
  openGraph: {
    title: 'DutyOnTrack — Smart Workforce Management SaaS',
    description: 'Multi-tenant Staffing SaaS with placement register, auto profit calculation, and live dashboards.',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
