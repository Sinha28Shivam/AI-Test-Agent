/**
 * DOM Extractor Agent
 * Extracts DOM elements from target website before test generation
 */

import { chromium, Browser, Page } from "@playwright/test";
import { logger } from "../utils/logger";
import { DOMElement, DOMSnapshot, DOMStatistics } from "./dom-types";
import { ScenarioStrategy } from "./scenario-strategy";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";

export class DOMExtractorAgent {
  private static readonly SNAPSHOTS_DIR = path.join("reports", "dom-snapshots");

  static async extract(
    url: string,
    strategies: ScenarioStrategy[] = []
  ): Promise<DOMSnapshot> {
    logger.info("DOM Extractor Agent is running...");
    logger.info(`Extracting DOM from: ${url}`);

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch();
      const snapshot = await this.extractFromPage(browser, url, strategies);
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

  static async extractAll(
    urls: string[],
    strategies: ScenarioStrategy[] = []
  ): Promise<DOMSnapshot[]> {
    if (urls.length === 0) return [];

    logger.info("DOM Extractor Agent is running (multi-URL mode)...");
    logger.info(`Extracting DOM from ${urls.length} URL(s): ${urls.join(" → ")}`);

    let browser: Browser | null = null;
    const snapshots: DOMSnapshot[] = [];

    try {
      browser = await chromium.launch();

      for (const url of urls) {
        try {
          const snapshot = await this.extractFromPage(browser, url, strategies);
          snapshots.push(snapshot);
        } catch (error) {
          logger.warn(`⚠ DOM extraction failed for ${url} (skipping): ${error}`);
        }
      }
    } catch (error) {
      logger.error(`DOM Extractor (multi-URL) failed to launch browser: ${error}`);
      throw new Error(`DOM Extraction failed: ${error}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    logger.success(`✓ DOM Extraction completed for ${snapshots.length}/${urls.length} URL(s)`);
    return snapshots;
  }

  private static async extractFromPage(
    browser: Browser,
    url: string,
    strategies: ScenarioStrategy[]
  ): Promise<DOMSnapshot> {
    logger.info(`  Extracting DOM from: ${url}`);

    if (strategies.length > 0) {
      logger.info(
        `  Scenario strategies active: ${strategies.map((s) => s.type).join(", ")}`
      );
      strategies.forEach((s) =>
        logger.info(`  [${s.type}] DOM hint: ${s.dom.contextHint}`)
      );
    }

    const page = await browser.newPage();
    try {
      // Navigate using load to avoid networkidle timeouts on slow tracking scripts
      await page.goto(url, { waitUntil: "load", timeout: 30000 });

      // Attempt networkidle but ignore timeouts
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {
        logger.info("Timeout waiting for network idle, proceeding with extraction...");
      });

      await page.waitForLoadState("domcontentloaded");

      const elements = await this.extractElements(page);
      const orderedElements = this.applyStrategyPriority(elements, strategies);
      const strategyHints = strategies.map((s) => `[${s.type}] ${s.dom.contextHint}`);
      const statistics = this.calculateStatistics(orderedElements);

      const timestamp = new Date().toISOString();
      const snapshot: DOMSnapshot = {
        url,
        timestamp: new Date().toISOString().substring(0, 10),
        extractedAt: timestamp,
        totalElements: orderedElements.length,
        elements: orderedElements,
        statistics,
        ...(strategyHints.length > 0 && { strategyHints }),
        extractionMethod: "playwright"
      };

      await this.saveSnapshotAsCSV(snapshot);

      logger.success(`  ✓ DOM Extraction done for ${url}. Found ${elements.length} elements`);
      logger.info(`    - Buttons: ${statistics.buttons}`);
      logger.info(`    - Inputs: ${statistics.inputs}`);
      logger.info(`    - Links: ${statistics.links}`);
      logger.info(`    - Interactive: ${statistics.interactiveElements}`);

      return snapshot;
    } finally {
      await page.close();
    }
  }

  private static async extractElements(page: Page): Promise<DOMElement[]> {
    const elements: DOMElement[] = [];

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
          if (visibleCount >= 30) break;

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

            const hasText = text && text.trim().length > 0;
            const hasPlaceholder = !!placeholder;
            const hasAriaLabel = !!ariaLabel;
            const isInputOrForm = ["input", "textarea", "select", "form"].includes(tagName);

            if (!hasText && !hasPlaceholder && !hasAriaLabel && !isInputOrForm && !id) {
              continue;
            }

            const generatedSelector = await el.evaluate((e) => {
              for (const attr of ["data-testid", "data-test", "data-cy"]) {
                const val = e.getAttribute(attr);
                if (val) return `[${attr}="${val}"]`;
              }

              if (e.id) {
                return `#${CSS.escape(e.id)}`;
              }

              const tagNameLower = e.tagName.toLowerCase();

              const nameAttr = e.getAttribute("name");
              if (nameAttr && ["input", "textarea", "select", "form"].includes(tagNameLower)) {
                return `${tagNameLower}[name="${nameAttr}"]`;
              }

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

              const pathParts: string[] = [];
              let currentElement: Element | null = e;

              while (currentElement && currentElement.nodeType === 1) {
                let currentSelector = currentElement.tagName.toLowerCase();

                if (currentElement.id) {
                  currentSelector = `#${CSS.escape(currentElement.id)}`;
                  pathParts.unshift(currentSelector);
                  break;
                } else {
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

                if (pathParts.length > 5) break;
              }

              return pathParts.join(" > ");
            }).catch(() => selector);

            const normalizedText = (text || "").trim().substring(0, 100) ||
                                   placeholder ||
                                   ariaLabel ||
                                   id ||
                                   "";

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
          } catch (_) {
            // Skip elements that can't be processed
          }
        }
      } catch (_) {
        // Skip selector if it errors
      }
    }

    const uniqueElements = Array.from(new Map(elements.map((e) => [e.selector, e])).values());
    return uniqueElements.slice(0, 100);
  }

  private static applyStrategyPriority(
    elements: DOMElement[],
    strategies: ScenarioStrategy[]
  ): DOMElement[] {
    if (strategies.length === 0) return elements;

    const prioritySelectors = strategies.flatMap((s) => s.dom.prioritySelectors);

    const isPriority = (el: DOMElement): boolean => {
      return prioritySelectors.some((sel) => {
        const lower = sel.toLowerCase();
        if (lower.includes('type="password"') && el.tagName === "input") {
          return el.selector.includes('password') || (el.placeholder || "").toLowerCase().includes("password");
        }
        if (lower.includes('type="email"') && el.tagName === "input") {
          return el.selector.includes('email') || (el.placeholder || "").toLowerCase().includes("email");
        }
        if (lower.includes('type="search"') && el.tagName === "input") {
          return el.selector.includes('search') || (el.placeholder || "").toLowerCase().includes("search");
        }
        if (lower.startsWith("nav a") || lower.startsWith('[role="navigation"]')) {
          return el.type === "link";
        }
        if (lower.includes("form") && el.type === "form") return true;
        if (lower === "h1" && el.tagName === "h1") return true;
        if (lower === "main" && el.tagName === "main") return true;
        return false;
      });
    };

    const prioritized = elements.filter(isPriority);
    const rest = elements.filter((el) => !isPriority(el));

    if (prioritized.length > 0) {
      logger.info(
        `  Strategy prioritized ${prioritized.length} element(s) to top of DOM snapshot`
      );
    }

    return [...prioritized, ...rest];
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

  private static csvEscape(val: string | null | undefined): string {
    const str = val == null ? "" : String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private static async saveSnapshotAsCSV(snapshot: DOMSnapshot): Promise<void> {
    try {
      await fs.mkdir(this.SNAPSHOTS_DIR, { recursive: true });

      const urlHash = crypto
        .createHash("md5")
        .update(snapshot.url)
        .digest("hex")
        .substring(0, 8);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
      const filename = `${timestamp}_${urlHash}.csv`;
      const filepath = path.join(this.SNAPSHOTS_DIR, filename);

      const header = "url,selector,type,text,tagName,id,ariaLabel,placeholder,href,isInteractive";
      const rows = snapshot.elements.map((el) =>
        [
          this.csvEscape(snapshot.url),
          this.csvEscape(el.selector),
          this.csvEscape(el.type),
          this.csvEscape(el.text),
          this.csvEscape(el.tagName),
          this.csvEscape(el.id),
          this.csvEscape(el.ariaLabel),
          this.csvEscape(el.placeholder),
          this.csvEscape(el.href),
          this.csvEscape(String(el.isInteractive))
        ].join(",")
      );

      await fs.writeFile(filepath, [header, ...rows].join("\n"), "utf8");
      logger.info(`✓ DOM snapshot saved to: ${filepath} (${snapshot.elements.length} rows)`);
    } catch (error) {
      logger.warn(`⚠ Failed to save DOM snapshot: ${error}`);
    }
  }
}
