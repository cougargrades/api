import { Request, Response } from 'express';
import firebase from '../util/firebase';
import { Util, Instructor } from '@cougargrades/types';
import { validationResult } from 'express-validator';

export async function getInstructors(req: Request<any, any, any, { limit: number; offset: number }>, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const query = await firebase
    .firestore()
    .collection('instructors')
    .orderBy('lastName')
    .orderBy('firstName')
    .offset(req.query.offset)
    .limit(req.query.limit)
    .get();
  return res.json(query.docs.map((item) => item.id));
}

export async function getInstructorByName(req: Request<{ instructorName: string }>, res: Response) {
  const doc = await firebase
    .firestore()
    .collection('instructors')
    .doc(req.params.instructorName)
    .get();

  if (doc.exists) {
    return res.json(Util.sanitizeInstructor(doc.data() as Instructor));
  } else {
    return res.sendStatus(404);
  }
}
