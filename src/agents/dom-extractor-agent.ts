/**
 * DOM Extractor Agent
 * Extracts DOM elements from target website before test generation
 */

import { chromium, Browser, Page } from "@playwright/test";
import { logger } from "../utils/logger";
import { DOMElement, DOMSnapshot, DOMStatistics } from "./dom-types";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";

export class DOMExtractorAgent {
  private static readonly SNAPSHOTS_DIR = path.join("reports", "dom-snapshots");

  static async extract(url: string): Promise<DOMSnapshot> {
    logger.info("DOM Extractor Agent is running...");
    logger.info(`Extracting DOM from: ${url}`);

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch();
      const page = await browser.newPage();

      // Navigate to the URL using load to avoid networkidle timeouts on slow tracking scripts
      await page.goto(url, { waitUntil: "load", timeout: 30000 });

      // Attempt networkidle but ignore timeouts so the process does not crash
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {
        logger.info("Timeout waiting for network idle, proceeding with extraction...");
      });

      // Wait for initial render
      await page.waitForLoadState("domcontentloaded");

      // Extract DOM elements
      const elements = await this.extractElements(page);

      // Calculate statistics
      const statistics = this.calculateStatistics(elements);

      // Create snapshot
      const timestamp = new Date().toISOString();
      const snapshot: DOMSnapshot = {
        url,
        timestamp: new Date().toISOString().substring(0, 10),
        extractedAt: timestamp,
        totalElements: elements.length,
        elements,
        statistics,
        extractionMethod: "playwright"
      };

      // Save snapshot to file
      await this.saveSnapshot(snapshot);

      logger.success(`✓ DOM Extraction completed. Found ${elements.length} elements`);
      logger.info(`  - Buttons: ${statistics.buttons}`);
      logger.info(`  - Inputs: ${statistics.inputs}`);
      logger.info(`  - Links: ${statistics.links}`);
      logger.info(`  - Interactive: ${statistics.interactiveElements}`);

      return snapshot;
    } catch (error) {
      logger.error(`DOM Extraction failed: ${error}`);
      throw new Error(`DOM Extraction failed: ${error}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private static async extractElements(page: Page): Promise<DOMElement[]> {
    const elements: DOMElement[] = [];

    // Extract interactive elements
    const interactiveSelectors = [
      { selector: "button", type: "button" as const },
      { selector: "a", type: "link" as const },
      { selector: "input", type: "input" as const },
      { selector: "textarea", type: "input" as const },
      { selector: "select", type: "input" as const },
      { selector: "form", type: "form" as const },
      { selector: "[onclick]", type: "other" as const },
      { selector: "[role='button']", type: "button" as const },
      { selector: "[role='link']", type: "link" as const }
    ];

    for (const { selector, type } of interactiveSelectors) {
      try {
        const elementsOfType = await page.locator(selector).all();
        let visibleCount = 0;

        for (const el of elementsOfType) {
          if (visibleCount >= 30) break; // Limit to 30 visible elements per type to prevent bloat

          try {
            const isVisible = await el.isVisible().catch(() => false);
            if (!isVisible) continue;

            const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
            const text = await el.textContent().catch(() => "");
            const id = await el.getAttribute("id").catch(() => null);
            const classes = (await el.getAttribute("class").catch(() => "")) || "";
            const ariaLabel = await el.getAttribute("aria-label").catch(() => null);
            const placeholder = await el.getAttribute("placeholder").catch(() => null);
            const href = await el.getAttribute("href").catch(() => null);

            // 1. Text check: Allow empty text if it is an input-like or form element, or has attributes
            const hasText = text && text.trim().length > 0;
            const hasPlaceholder = !!placeholder;
            const hasAriaLabel = !!ariaLabel;
            const isInputOrForm = ["input", "textarea", "select", "form"].includes(tagName);

            if (!hasText && !hasPlaceholder && !hasAriaLabel && !isInputOrForm && !id) {
              continue; // Skip elements that have no content or identifiers
            }

            // Generate smart CSS selector inside the browser context
            const generatedSelector = await el.evaluate((e) => {
              // 1. Check for data-testid or other testing attributes
              for (const attr of ["data-testid", "data-test", "data-cy"]) {
                const val = e.getAttribute(attr);
                if (val) return `[${attr}="${val}"]`;
              }

              // 2. Check for unique ID
              if (e.id) {
                return `#${CSS.escape(e.id)}`;
              }

              const tagNameLower = e.tagName.toLowerCase();

              // 3. Check for Name attribute (very stable on input elements)
              const nameAttr = e.getAttribute("name");
              if (nameAttr && ["input", "textarea", "select", "form"].includes(tagNameLower)) {
                return `${tagNameLower}[name="${nameAttr}"]`;
              }

              // 4. Check for href (for links if relatively short)
              if (tagNameLower === "a") {
                const hrefAttr = e.getAttribute("href");
                if (
                  hrefAttr &&
                  hrefAttr.length < 50 &&
                  !hrefAttr.startsWith("http") &&
                  !hrefAttr.startsWith("//") &&
                  !hrefAttr.startsWith("javascript:")
                ) {
                  return `a[href="${hrefAttr}"]`;
                }
              }

              // 5. Fallback: Build unique hierarchical path with nth-of-type to avoid strict mode violations
              const pathParts: string[] = [];
              let currentElement: Element | null = e;

              while (currentElement && currentElement.nodeType === 1) {
                let currentSelector = currentElement.tagName.toLowerCase();

                if (currentElement.id) {
                  currentSelector = `#${CSS.escape(currentElement.id)}`;
                  pathParts.unshift(currentSelector);
                  break; // Unique ID found, we can stop climbing
                } else {
                  // Find nth-of-type index among siblings of the same tag
                  let sibling = currentElement;
                  let nth = 1;
                  while (sibling.previousElementSibling) {
                    sibling = sibling.previousElementSibling;
                    if (sibling.tagName === currentElement.tagName) {
                      nth++;
                    }
                  }

                  let hasSiblings = false;
                  let next = currentElement;
                  while (next.nextElementSibling) {
                    next = next.nextElementSibling;
                    if (next.tagName === currentElement.tagName) {
                      hasSiblings = true;
                      break;
                    }
                  }

                  if (nth > 1 || hasSiblings) {
                    currentSelector += `:nth-of-type(${nth})`;
                  }
                }

                pathParts.unshift(currentSelector);
                currentElement = currentElement.parentElement;

                if (pathParts.length > 5) break; // Limit depth to prevent extremely long paths
              }

              return pathParts.join(" > ");
            }).catch(() => selector);

            // Normalize text field to give AI generator best descriptor
            const normalizedText = (text || "").trim().substring(0, 100) || 
                                   placeholder || 
                                   ariaLabel || 
                                   id || 
                                   "";

            // Push processed element conforming to exactOptionalPropertyTypes
            const elementToPush: DOMElement = {
              selector: generatedSelector,
              type,
              text: normalizedText,
              tagName,
              isInteractive: true
            };

            if (classes) {
              elementToPush.classes = typeof classes === "string" ? classes.split(" ").filter((c) => c) : [];
            }
            if (id) {
              elementToPush.id = id;
            }
            if (ariaLabel) {
              elementToPush.ariaLabel = ariaLabel;
            }
            if (placeholder) {
              elementToPush.placeholder = placeholder;
            }
            if (href) {
              elementToPush.href = href;
            }

            elements.push(elementToPush);
            visibleCount++;
          } catch (error) {
            // Skip elements that can't be processed
          }
        }
      } catch (error) {
        // Skip selector if it errors
      }
    }

    // Remove duplicates based on selector
    const uniqueElements = Array.from(new Map(elements.map((e) => [e.selector, e])).values());

    return uniqueElements.slice(0, 100); // Limit to 100 elements total
  }

  private static calculateStatistics(elements: DOMElement[]): DOMStatistics {
    return {
      buttons: elements.filter((e) => e.type === "button").length,
      inputs: elements.filter((e) => e.type === "input").length,
      links: elements.filter((e) => e.type === "link").length,
      images: elements.filter((e) => e.type === "image").length,
      forms: elements.filter((e) => e.type === "form").length,
      headers: elements.filter((e) => e.type === "header").length,
      interactiveElements: elements.filter((e) => e.isInteractive).length,
      totalElements: elements.length
    };
  }

  private static async saveSnapshot(snapshot: DOMSnapshot): Promise<void> {
    try {
      // Create snapshots directory
      await fs.mkdir(this.SNAPSHOTS_DIR, { recursive: true });

      // Generate filename with timestamp and URL hash
      const urlHash = crypto
        .createHash("md5")
        .update(snapshot.url)
        .digest("hex")
        .substring(0, 8);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
      const filename = `${timestamp}_${urlHash}.json`;

      const filepath = path.join(this.SNAPSHOTS_DIR, filename);

      // Write snapshot to file
      await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2), "utf8");

      logger.info(`✓ DOM snapshot saved to: ${filepath}`);
    } catch (error) {
      logger.warn(`⚠ Failed to save DOM snapshot: ${error}`);
    }
  }
}
