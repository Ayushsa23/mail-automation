import { Request, Response, NextFunction } from 'express';

/**
 * Wraps async route handlers to catch errors and pass them to Express error handler
 * This ensures all errors are caught and responses are always sent
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('asyncHandler caught error:', err);
      console.error('Error stack:', err.stack);
      
      // If response has already been sent, don't try to send again
      if (!res.headersSent) {
        console.log('Passing error to Express error handler');
        next(err);
      } else {
        console.error('Error after response sent - cannot send error response:', err);
      }
    });
  };
};

