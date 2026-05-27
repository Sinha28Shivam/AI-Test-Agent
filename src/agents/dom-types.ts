/**
 * DOM Element and Snapshot Type Definitions
 */

export interface DOMElement {
  selector: string;
  type: 'button' | 'input' | 'link' | 'text' | 'form' | 'image' | 'header' | 'container' | 'other';
  text?: string;
  classes?: string[];
  id?: string;
  tagName: string;
  isInteractive: boolean;
  ariaLabel?: string;
  placeholder?: string;
  href?: string;
  iframeContext?: string | null;
}

export interface DOMStatistics {
  buttons: number;
  inputs: number;
  links: number;
  images: number;
  forms: number;
  headers: number;
  interactiveElements: number;
  totalElements: number;
}

export interface DOMSnapshot {
  url: string;
  timestamp: string;
  extractedAt: string;
  totalElements: number;
  elements: DOMElement[];
  statistics: DOMStatistics;
  hierarchy?: string;
  strategyHints?: string[];  // context hints from active ScenarioStrategies
  extractionMethod: 'playwright' | 'http';
}
