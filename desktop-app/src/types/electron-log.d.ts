// Type declarations for modules without proper TypeScript support

declare module 'electron-log' {
  export interface LogFunctions {
    error(...params: any[]): void;
    warn(...params: any[]): void;
    info(...params: any[]): void;
    verbose(...params: any[]): void;
    debug(...params: any[]): void;
    silly(...params: any[]): void;
    log(...params: any[]): void;
  }

  export interface LogFile {
    level: string;
    fileName: string;
    maxSize: number;
  }

  export interface Transports {
    file: LogFile;
    console: LogFunctions;
  }

  export interface Logger extends LogFunctions {
    transports: Transports;
    catchErrors(options?: { showDialog?: boolean }): void;
  }

  const log: Logger;
  export default log;
}
