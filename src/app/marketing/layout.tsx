import type { Metadata, Viewport } from "next";
import { Bangers, Space_Grotesk } from "next/font/google";

const bangers = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bangers",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://conferenceday.app"),
  title: "Conference Day | Day-Of Attendee App for Conferences & Events",
  description:
    "The day-of mobile app for conferences and events. Session schedules, live polls, push notifications, sponsor tools, and real-time attendee engagement — no app store required.",
  alternates: {
    canonical: "https://conferenceday.app",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://conferenceday.app",
    siteName: "Conference Day",
    title: "Conference Day | Day-Of Attendee App for Conferences & Events",
    description:
      "The day-of mobile app for conferences and events. Schedules, live polls, push notifications, sponsor tools — everything your attendees need.",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 800,
        alt: "Conference Day — day-of attendee app for conferences",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@jeffblankenburg",
    creator: "@jeffblankenburg",
    title: "Conference Day | Day-Of Attendee App for Conferences & Events",
    description:
      "The day-of mobile app for conferences and events. Schedules, live polls, push notifications, sponsor tools — no app store required.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${bangers.variable} ${spaceGrotesk.variable}`}>
      {children}
    </div>
  );
}
