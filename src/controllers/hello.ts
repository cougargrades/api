import { Request, Response } from 'express';

/**
 * GET /hello
 * Home page.
 */
export async function world(req: Request, res: Response<string>) {
  return res.json('Hello, World!');
}
