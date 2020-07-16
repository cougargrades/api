//import { User, UserDocument, AuthToken } from "../models/User";
import { Request, Response } from 'express';

/**
 * GET /login
 * Login page.
 */
export const getLogin = async (req: Request, res: Response) => {
  // if (req.user) {
  //     return res.redirect("/");
  // }
  res.send('Get login');
};
