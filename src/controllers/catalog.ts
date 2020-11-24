import { Request, Response } from 'express';
import firebase from '../util/firebase';
import { Util, Course, Section, Instructor } from '@cougargrades/types';
import { validationResult } from 'express-validator';

export async function getCourses(
  req: Request<any, any, any, { limit: number; offset: number }>,
  res: Response,
) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const query = await firebase
    .firestore()
    .collection('catalog')
    .orderBy('department')
    .orderBy('catalogNumber')
    .offset(req.query.offset)
    .limit(req.query.limit)
    .get();
  return res.json(query.docs.map((item) => item.id));
}

export async function getCourseByName(
  req: Request<{ courseName: string }>,
  res: Response,
) {
  const doc = await firebase
    .firestore()
    .collection('catalog')
    .doc(req.params.courseName)
    .get();

  if (doc.exists) {
    return res.json(Util.sanitizeCourse(doc.data() as Course));
  } else {
    return res.sendStatus(404);
  }
}

export async function getSectionsForCourse(
  req: Request<{ courseName: string }>,
  res: Response,
) {
  const doc = await firebase
    .firestore()
    .collection('catalog')
    .doc(req.params.courseName)
    .get();

  if (doc.exists) {
    const data = doc.data() as Course;
    if (Util.isDocumentReferenceArray(data.sections)) {
      const populated = await Util.populate<Section>(data.sections);
      return res.json(populated.map((item) => Util.sanitizeSection(item)));
    } else {
      return res.sendStatus(409);
    }
  } else {
    return res.sendStatus(404);
  }
}

export async function getInstructorsForCourse(
  req: Request<{ courseName: string }>,
  res: Response,
) {
  const doc = await firebase
    .firestore()
    .collection('catalog')
    .doc(req.params.courseName)
    .get();

  if (doc.exists) {
    const data = doc.data() as Course;
    if (Util.isDocumentReferenceArray(data.instructors)) {
      const populated = await Util.populate<Instructor>(data.instructors);
      return res.json(populated.map((item) => Util.sanitizeInstructor(item)));
    } else {
      return res.sendStatus(409);
    }
  } else {
    return res.sendStatus(404);
  }
}
