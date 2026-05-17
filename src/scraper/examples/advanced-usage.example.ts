// /**
//  * Advanced Usage Examples for Playwright Scraper Service
//  *
//  * This file demonstrates various advanced scraping scenarios
//  * that can be implemented using the ScraperService.
//  *
//  * Note: This is an example file and not meant to be imported directly.
//  * Use these patterns in your services or controllers.
//  */

// import { Injectable } from '@nestjs/common';
// import { ScraperService } from '../scraper.service';
// import { ScrapeOptions, ExtractConfig } from '../interfaces/scraper.interface';

// /**
//  * Example 1: E-commerce Product Scraping
//  * Scrapes product information from an e-commerce site
//  */
// @Injectable()
// export class EcommerceScraperExample {
//   constructor(private readonly scraperService: ScraperService) {}

//   async scrapeProduct(url: string) {
//     const options: ScrapeOptions = {
//       url,
//       waitForSelector: '.product-details',
//       timeout: 30000,
//       screenshot: true,
//       screenshotPath: `product-${Date.now()}.png`,
//     };

//     const result = await this.scraperService.scrape(options);

//     // Extract structured data
//     const extractConfig: ExtractConfig = {
//       title: 'h1.product-title',
//       description: '.product-description',
//       image: '.product-image img',
//       custom: {
//         price: { selector: '.price', textContent: true },
//         rating: { selector: '.rating', attribute: 'data-rating' },
//         reviews: {
//           selector: '.review-item',
//           multiple: true,
//           textContent: true,
//         },
//         specifications: {
//           selector: '.spec-table tr',
//           multiple: true,
//         },
//       },
//     };

//     // Note: You would need to call extractStructuredData separately
//     // or modify the scrape method to accept extractConfig

//     return result;
//   }
// }

// /**
//  * Example 2: News Article Aggregator
//  * Scrapes multiple news articles concurrently
//  */
// @Injectable()
// export class NewsAggregatorExample {
//   constructor(private readonly scraperService: ScraperService) {}

//   async aggregateNews(urls: string[]) {
//     const results = await this.scraperService.scrapeMultiple(
//       urls,
//       {
//         waitForSelector: 'article',
//         timeout: 20000,
//         headers: {
//           'Accept-Language': 'en-US,en;q=0.9',
//         },
//       },
//       5, // 5 concurrent scrapes
//     );

//     return results.map((result) => ({
//       url: result.url,
//       title: result.title,
//       contentLength: result.content?.length || 0,
//       scrapedAt: result.timestamp,
//     }));
//   }
// }

// /**
//  * Example 3: Social Media Profile Scraper
//  * Demonstrates using cookies for authenticated scraping
//  */
// @Injectable()
// export class SocialMediaScraperExample {
//   constructor(private readonly scraperService: ScraperService) {}

//   async scrapeProfile(profileUrl: string, authCookies: Array<{ name: string; value: string; domain: string }>) {
//     const options: ScrapeOptions = {
//       url: profileUrl,
//       waitForSelector: '.profile-info',
//       timeout: 30000,
//       cookies: authCookies.map((cookie) => ({
//         ...cookie,
//         path: '/',
//       })),
//       userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
//     };

//     const result = await this.scraperService.scrape(options);
//     return result;
//   }
// }

// /**
//  * Example 4: Real Estate Listing Scraper
//  * Scrapes property listings with pagination
//  */
// @Injectable()
// export class RealEstateScraperExample {
//   constructor(private readonly scraperService: ScraperService) {}

//   async scrapeListings(baseUrl: string, pages = 5) {
//     const urls: string[] = [];

//     // Generate URLs for multiple pages
//     for (let i = 1; i <= pages; i++) {
//       urls.push(`${baseUrl}?page=${i}`);
//     }

//     const results = await this.scraperService.scrapeMultiple(
//       urls,
//       {
//         waitForSelector: '.listing-item',
//         timeout: 25000,
//       },
//       3,
//     );

//     return results.map((result) => ({
//       pageUrl: result.url,
//       title: result.title,
//       scrapedAt: result.timestamp,
//     }));
//   }
// }

// /**
//  * Example 5: Job Board Scraper with Custom Data Extraction
//  * Scrapes job postings with detailed extraction
//  */
// export const jobBoardScrapeExample = {
//   url: 'https://example-jobboard.com/jobs',
//   extractConfig: {
//     title: 'h1.job-title',
//     description: '.job-description',
//     custom: {
//       company: { selector: '.company-name', textContent: true },
//       location: { selector: '.job-location', textContent: true },
//       salary: { selector: '.salary-range', textContent: true },
//       jobType: { selector: '.employment-type', textContent: true },
//       requirements: {
//         selector: '.requirements li',
//         multiple: true,
//         textContent: true,
//       },
//       benefits: {
//         selector: '.benefits li',
//         multiple: true,
//         textContent: true,
//       },
//       applyLink: {
//         selector: 'a.apply-button',
//         attribute: 'href',
//       },
//     },
//   } as ExtractConfig,
// };

// /**
//  * Example 6: Price Monitoring Scraper
//  * Monitors product prices across multiple e-commerce sites
//  */
// @Injectable()
// export class PriceMonitorExample {
//   constructor(private readonly scraperService: ScraperService) {}

//   async monitorPrices(products: Array<{ name: string; url: string; selector: string }>) {
//     const urls = products.map((p) => p.url);

//     const results = await this.scraperService.scrapeMultiple(urls, {
//       waitForSelector: '.price',
//       timeout: 20000,
//     });

//     return results.map((result, index) => ({
//       product: products[index].name,
//       url: result.url,
//       price: result.data['price'] || null,
//       timestamp: result.timestamp,
//     }));
//   }
// }

// /**
//  * Example 7: Dynamic Content Scraper with Infinite Scroll
//  * Demonstrates handling JavaScript-rendered content
//  */
// export const dynamicContentExample = {
//   async scrapeWithInfiniteScroll(scraperService: ScraperService, url: string) {
//     // This is a conceptual example - actual implementation would require
//     // more complex Playwright scripting with page.evaluate()
//     const options: ScrapeOptions = {
//       url,
//       waitForSelector: '.content-item',
//       timeout: 60000, // Longer timeout for dynamic content
//       screenshot: true,
//     };

//     return await scraperService.scrape(options);
//   },
// };

// /**
//  * Usage in a NestJS Service
//  *
//  * @example
//  * import { Injectable } from '@nestjs/common';
//  * import { ScraperService } from './scraper/scraper.service';
//  *
//  * @Injectable()
//  * export class MyService {
//  *   constructor(private readonly scraper: ScraperService) {}
//  *
//  *   async doScraping() {
//  *     // Single page scrape
//  *     const result = await this.scraper.scrape({
//  *       url: 'https://example.com',
//  *       waitForSelector: '.main-content',
//  *     });
//  *
//  *     // Multiple pages
//  *     const results = await this.scraper.scrapeMultiple(
//  *       ['url1', 'url2', 'url3'],
//  *       { timeout: 30000 },
//  *       3
//  *     );
//  *
//  *     return results;
//  *   }
//  * }
//  */
