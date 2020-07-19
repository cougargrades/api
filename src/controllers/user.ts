//import { User, UserDocument, AuthToken } from "../models/User";
import { Request, Response } from 'express';
import firebase from '../util/firebase';
import { Course, Util, Section } from '@cougargrades/types';

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
  const doc = await firebase.firestore().doc('catalog/CHEM 1331').get();

  const data: Course = doc.data() as Course;

  if (Util.isDocumentReferenceArray(data.sections)) {
    //const sanitize = ({instructors, sections, ...o}: Course) => o;
    res.json(
      // combine franken-object
      Object.assign(
        // remove properties where DocumentReference<T> is
        Util.sanitizeCourse(data),
        // add them back manually
        {
          sections: (await Util.populate<Section>(data.sections)).map((e) =>
            Util.sanitizeSection(e),
          ),
        },
      ),
    );
  }
};
