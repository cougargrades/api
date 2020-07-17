//import { User, UserDocument, AuthToken } from "../models/User";
import { Request, Response } from 'express';
import { MONGODB_URI, SESSION_SECRET, ENVIRONMENT } from '../util/secrets';

/**
 * GET /login
 * Login page.
 */
export const getUser = async (req: Request, res: Response) => {
  // if (req.user) {
  //     return res.redirect("/");
  // }
  res.send('get user!');
};

export const getSecret = async (req: Request, res: Response) => {
  res.json({
    MONGODB_URI,
    SESSION_SECRET,
    ENVIRONMENT
  })
}
