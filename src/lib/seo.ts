import { business, SITE_URL } from '../data/site';

type JsonLdProps = {
  type?: 'home' | 'page';
  name: string;
  description: string;
  path: string;
  breadcrumbs?: { name: string; path: string }[];
  faqs?: { question: string; answer: string }[];
};

export function businessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['AutoRepair', 'AutomotiveBusiness'],
    '@id': `${SITE_URL}/#business`,
    name: business.name,
    legalName: business.legalName,
    alternateName: business.shortName,
    description: business.description,
    url: SITE_URL,
    telephone: business.telephone,
    image: `${SITE_URL}/og-image.png`,
    logo: `${SITE_URL}/images/logo.png`,
    priceRange: business.priceRange,
    currenciesAccepted: 'GBP',
    paymentAccepted: 'Cash, Credit Card, Debit Card',
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.streetAddress,
      addressLocality: business.addressLocality,
      addressRegion: business.addressRegion,
      postalCode: business.postalCode,
      addressCountry: business.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: business.latitude,
      longitude: business.longitude,
    },
    hasMap: business.mapsUrl,
    openingHoursSpecification: business.openingHours.map((block) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: block.days,
      opens: block.opens,
      closes: block.closes,
    })),
    areaServed: business.areaServed.map((name) => ({
      '@type': 'City',
      name,
    })),
    makesOffer: business.services.map((service) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: service.name,
        description: service.description,
        areaServed: business.addressLocality,
        provider: { '@id': `${SITE_URL}/#business` },
      },
    })),
    sameAs: [business.mapsUrl],
  };
}

export function pageJsonLd({ type = 'page', name, description, path, breadcrumbs = [], faqs = [] }: JsonLdProps) {
  const graph: Record<string, unknown>[] = [
    businessJsonLd(),
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: business.name,
      description: business.description,
      inLanguage: 'en-GB',
      publisher: { '@id': `${SITE_URL}/#business` },
    },
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}${path === '/' ? '/' : path}#webpage`,
      url: `${SITE_URL}${path === '/' ? '/' : path}`,
      name,
      description,
      inLanguage: 'en-GB',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#business` },
    },
  ];

  if (type === 'home') {
    graph.push({
      '@type': 'OfferCatalog',
      name: 'Workshop services',
      itemListElement: business.services.map((service, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: { '@type': 'Service', name: service.name, description: service.description },
      })),
    });
  }

  if (breadcrumbs.length > 0) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: `${SITE_URL}${crumb.path === '/' ? '/' : crumb.path}`,
      })),
    });
  }

  if (faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
