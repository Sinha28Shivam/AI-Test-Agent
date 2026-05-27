/**
 * DOM Extractor Agent
 * Extracts DOM elements from target website before test generation
 */

import { chromium, Browser, Page, Frame } from "@playwright/test";
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

  private static async extractElements(page: Page | Frame): Promise<DOMElement[]> {
    try {
      const rawElements = await page.evaluate(() => {
        const elementsList: any[] = [];

        // Recursive tree crawler function
        function crawlNode(node: Node, currentIframeSelector: string | null = null) {
          if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

          const el = node as Element;
          const tagName = el.tagName.toLowerCase();

          // 1. Identify interactive or valuable structural layout elements
          const hasOnclick = el.hasAttribute("onclick");
          const role = el.getAttribute("role");
          const isInteractiveTag = [
            "button", "a", "input", "textarea", "select", "form", 
            "iframe", "h1", "h2", "h3", "main", "header", "nav"
          ].includes(tagName);

          const isInteractiveRole = role && ["button", "link", "searchbox", "dialog", "alert"].includes(role);

          if (isInteractiveTag || isInteractiveRole || hasOnclick) {
            // Check operational visibility safely in client scope
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisible = rect.width > 0 && rect.height > 0 && 
                              style.display !== "none" && style.visibility !== "hidden";

            if (isVisible) {
              // Generate robust selector strategies natively
              let generatedSelector = "";
              
              // Priority 1: Data Test Attributes
              for (const attr of ["data-testid", "data-test", "data-cy"]) {
                const val = el.getAttribute(attr);
                if (val) {
                  generatedSelector = `[${attr}="${val}"]`;
                  break;
                }
              }

              // Priority 2: ID Attributes
              if (!generatedSelector && el.id) {
                generatedSelector = `#${CSS.escape(el.id)}`;
              }

              // Priority 3: Component Names / Fallback Pathing
              if (!generatedSelector) {
                const nameAttr = el.getAttribute("name");
                if (nameAttr && ["input", "textarea", "select", "form"].includes(tagName)) {
                  generatedSelector = `${tagName}[name="${nameAttr}"]`;
                } else {
                  generatedSelector = tagName; // Base strategy fallback
                }
              }

              // Map standard element properties
              const text = (el.textContent || "").trim().substring(0, 100);
              const placeholder = el.getAttribute("placeholder") || null;
              const ariaLabel = el.getAttribute("aria-label") || null;
              const href = el.getAttribute("href") || null;
              const id = el.id || null;
              const classes = el.className && typeof el.className === "string" ? el.className.split(" ").filter(c => c) : [];

              // Categorize operational typing
              let calculatedType: any = "other";
              if (["button"].includes(tagName) || role === "button") calculatedType = "button";
              else if (["a"].includes(tagName) || role === "link") calculatedType = "link";
              else if (["input", "textarea", "select"].includes(tagName)) calculatedType = "input";
              else if (["form"].includes(tagName)) calculatedType = "form";
              else if (["h1", "h2", "h3"].includes(tagName)) calculatedType = "header";

              elementsList.push({
                selector: generatedSelector,
                type: calculatedType,
                text: text || placeholder || ariaLabel || id || "",
                tagName,
                isInteractive: true,
                id,
                classes,
                ariaLabel,
                placeholder,
                href,
                // Meta attributes for frame-aware matching
                iframeContext: currentIframeSelector
              });
            }
          }

          // 2. PIERCE OPEN SHADOW DOM (Open roots)
          if (el.shadowRoot) {
            const shadowChildren = el.shadowRoot.childNodes;
            for (let i = 0; i < shadowChildren.length; i++) {
              const child = shadowChildren[i];
              if (child) {
                crawlNode(child, currentIframeSelector);
              }
            }
          }

          // 3. RECURSIVELY WALK STANDARD LIGHT DOM CHILDREN
          const children = el.childNodes;
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child) {
              crawlNode(child, currentIframeSelector);
            }
          }
        }

        // Start processing from document trunk body element
        crawlNode(document.body);
        return elementsList;
      });

      // 4. PIERCE INTERIOR IFRAME CONTENT LAYERS OUTSIDE BROWSER ISOLATION CONTEXT
      const finalElements: DOMElement[] = [...rawElements];
      const childFrames = ('childFrames' in page) ? (page as Frame).childFrames() : (page as Page).mainFrame().childFrames();

      for (const frame of childFrames) {
        try {
          const frameElementHandle = await frame.frameElement();
          if (frameElementHandle) {
            const frameSrc = (await frameElementHandle.getAttribute("src")) || "iframe";
            // Recursively crawl elements inside the active sub-frame context
            const frameElements = await this.extractElements(frame);
            
            // Map them out tracking frame identity lineage
            frameElements.forEach(fe => {
              fe.selector = `iframe[src="${frameSrc}"] >>> ${fe.selector}`;
              finalElements.push(fe);
            });
          }
        } catch (e) {
          // Suppress restricted cross-origin iframe security errors safely
        }
      }

      // De-duplicate targets cleanly via built selectors and return full array
      const uniqueElements = Array.from(new Map(finalElements.map((e) => [e.selector, e])).values());
      
      // REMOVED `.slice(0, 100)` and counter limits to capture EVERYTHING
      return uniqueElements;

    } catch (error) {
      return [];
    }
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
