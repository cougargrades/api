import { Request, Response, NextFunction } from 'express';

export const API_PREFIX = 'api';

// Rewrite Firebase hosting requests: /api/:path => /:path
// see: https://stackoverflow.com/a/49216233
export const rewriteFirebaseHosting = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.url.indexOf(`/${API_PREFIX}/`) === 0) {
    req.url = req.url.substring(API_PREFIX.length + 1);
  }
  next();
};
