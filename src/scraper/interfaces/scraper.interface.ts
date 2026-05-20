export interface ScrapeOptions {
  url: string;
  timeout?: number;
  headers?: Record<string, string>;
  userAgent?: string;
  cookies?: Array<{ name: string; value: string }>;
  bypassCSP?: boolean;
  screenshot?: boolean;
  screenshotPath?: string;
  waitForSelector?: string;
  addStyleHidePopup?: boolean | string;
  handlePopupClose?: boolean;
  pageLocatorPerformClick?: string;
  pageLocatorPerformClickCoordinate?: {
    x: number;
    y: number;
    isLoop?: boolean;
  };
  addPageEvaluate?: (() => void)[];
  pageLocatorPerformAutoScroll?: boolean;
  addPageEvaluateLazyScroll?: boolean;
  maxScrollAttempts?: number;
}

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  data: Record<string, unknown>;
  timestamp: string;
  duration: number;
  screenshot?: string;
}

export interface ExtractConfig {
  title?: string;
  description?: string;
  image?: string;
  links?: { selector: string; attribute?: string };
  custom?: Record<string, ElementSelector>;
}

export interface ElementSelector {
  selector: string;
  attribute?: string;
  textContent?: boolean;
  multiple?: boolean;
}
