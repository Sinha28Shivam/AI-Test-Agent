import MCPBridge from './MCPBridge.js';

class MCPBridgePool {
  constructor() {
    this.idleBridges = [];
    this.activeBridges = new Set();
    this.maxConcurrency = parseInt(process.env.MAX_CONCURRENT_RUNS || '3', 10);
  }

  async acquire() {
    // Check if we have an idle bridge
    if (this.idleBridges.length > 0) {
      const bridge = this.idleBridges.pop();
      this.activeBridges.add(bridge);
      console.log(`[MCPBridgePool] Borrowed idle MCP bridge (active: ${this.activeBridges.size}, idle: ${this.idleBridges.length})`);
      return bridge;
    }

    // Create a new bridge
    const bridge = new MCPBridge();
    await bridge.start();
    this.activeBridges.add(bridge);
    console.log(`[MCPBridgePool] Created new MCP bridge (active: ${this.activeBridges.size}, idle: ${this.idleBridges.length})`);
    return bridge;
  }

  async release(bridge) {
    if (this.activeBridges.has(bridge)) {
      this.activeBridges.delete(bridge);
      
      // Clean up browser context of this bridge to isolate state for next borrower
      try {
        await bridge.callTool('browser_close');
      } catch (e) {
        // Ignore if browser already closed
      }

      this.idleBridges.push(bridge);
      console.log(`[MCPBridgePool] Released MCP bridge to idle pool (active: ${this.activeBridges.size}, idle: ${this.idleBridges.length})`);
    }
  }

  async shutdownAll() {
    console.log(`[MCPBridgePool] Shutting down all MCP bridges in pool...`);
    const all = [...this.activeBridges, ...this.idleBridges];
    this.activeBridges.clear();
    this.idleBridges = [];
    
    for (const bridge of all) {
      await bridge.stop().catch(() => {});
    }
  }
}

const mcpBridgePool = new MCPBridgePool();
export default mcpBridgePool;
