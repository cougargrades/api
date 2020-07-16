import { Request, Response, NextFunction } from 'express';

/**
 * GET /
 * Home page.
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    next(Error("Hello"))
    res.send('Hello, World!');
  }
  catch(err) {
    res.send(err)
  }
};
