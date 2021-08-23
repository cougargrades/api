
import * as core_curriculum from '@cougargrades/publicdata/bundle/edu.uh.publications.core/core_curriculum.json'
import { Group } from '@cougargrades/types';
import { db } from '../_firebaseHelper';

export function getCoreCurriculumDocRefs(courseName: string): FirebaseFirestore.DocumentReference<Group>[] {
  const [department, catalogNumber] = courseName.trim().split(' ')
  return core_curriculum
    .filter(e => e.department === department && e.catalogNumber === catalogNumber) // finds matches
    .map(e => e.coreCode) // "10"
    .map(e => db.doc(`/groups/${e}`)) as FirebaseFirestore.DocumentReference<Group>[];
}
