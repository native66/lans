export const logger = {
  formatMsg(level: "info" | "warn" | "error", message: string, metadata?: any) {
    const now = new Date();
    // Simulate nanoseconds for the outer timestamp to match the exact pattern
    const iso = now.toISOString();
    const nano = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const outerIso = iso.replace('Z', nano + 'Z');
    
    const innerDate = iso.split('T')[0];
    const innerTime = iso.split('T')[1].substring(0, 12);
    
    const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    return `[${outerIso}] [info] ${innerDate} ${innerTime} [${level}] ${message}${metaStr}`;
  },
  
  info(message: string, metadata?: any) {
    console.log(this.formatMsg("info", message, metadata));
  },
  
  warn(message: string, metadata?: any) {
    console.warn(this.formatMsg("warn", message, metadata));
  },
  
  error(message: string, metadata?: any) {
    console.error(this.formatMsg("error", message, metadata));
  }
};
