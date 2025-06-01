declare module 'xss-clean' {
    import { RequestHandler } from 'express';
    
    // Export a default function that returns an Express middleware
    const xssClean: () => RequestHandler;
    
    export = xssClean;
  }