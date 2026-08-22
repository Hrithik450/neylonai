/**
 * JSON-LD Structured Data for SEO
 * Add this to your layout or page components
 */

export function OrganizationJsonLd() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://neylonai.mhrithik.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Neylon AI",
    url: baseUrl,
    logo: `${baseUrl}/images/neylonai-logo.jpg`,
    description:
      "AI-powered customer engagement platform specializing in real-time visitor tracking and proactive conversational AI.",
    sameAs: [
      "https://twitter.com/mhritihk470",
      "https://www.linkedin.com/in/hruthik-m-3595a0329/",
      "https://github.com/hruthikm/neylonai",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      email: "support@neylonai.mhrithik.com",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebsiteJsonLd() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://neylonai.mhrithik.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Neylon AI",
    url: baseUrl,
    description:
      "AI-powered customer engagement platform with real-time visitor insights and proactive conversations.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://neylonai.mhrithik.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Neylon AI",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier available with paid plans",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "127",
    },
    description:
      "AI-powered customer engagement platform that watches visitors in real time and starts conversations at the right moment.",
    url: baseUrl,
    screenshot: `${baseUrl}/images/opengraph-neylonai.png`,
    featureList: [
      "Real-time visitor tracking",
      "Proactive AI conversations",
      "Custom AI agents",
      "Integration with knowledge bases",
      "Analytics and insights",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function FAQJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is Neylon AI?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Neylon AI is an AI-powered customer engagement platform that tracks website visitors in real time and initiates proactive conversations at the optimal moment to convert traffic into meaningful engagement.",
        },
      },
      {
        "@type": "Question",
        name: "How does real-time visitor tracking work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Neylon AI monitors visitor behavior including page views, scroll depth, time on page, and interaction patterns to understand intent and engagement level, enabling timely and contextual conversations.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a free plan available?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, Neylon AI offers a free tier that allows you to get started with AI-powered customer engagement. Paid plans are available for advanced features and higher usage limits.",
        },
      },
      {
        "@type": "Question",
        name: "What integrations does Neylon AI support?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Neylon AI integrates with various knowledge bases, CRMs, and communication tools to provide context-aware AI conversations using your existing data and workflows.",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
