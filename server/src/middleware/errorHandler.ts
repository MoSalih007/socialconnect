import { Request, Response, NextFunction } from 'express';

export function notFound(req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found' });
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production') console.error('Unhandled error:', err);

  // Handle malformed JSON body (SyntaxError from body-parser)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }

  // Handle payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large' });
  }

  // PostgreSQL constraint errors
  if (err.code === '23505') return res.status(409).json({ message: 'Resource already exists' });
  if (err.code === '23503') return res.status(404).json({ message: 'Related resource not found' });
  if (err.code === '23502') return res.status(400).json({ message: 'Required field missing' });

  // JWT errors
  if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token' });
  if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired' });

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed' });
  }

  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error'
  });
}
