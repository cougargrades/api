import { db } from '../src/_firebaseHelper'
import * as fs from 'fs'
import * as path from 'path'
import * as csvParser from 'csv-parse/lib/sync'
import { path as root } from 'app-root-path'

/**
 * Shortcut function for parsing CSV files
 * @param fileName 
 * @returns 
 */
export function csv(fileName: string): any[] {
  return csvParser(fs.readFileSync(path.resolve(root, 'test', fileName)), { columns: true });
}

/**
 * Delete an entire collection in parallel
 * @param name 
 * @returns 
 */
export async function deleteCollection(name: string): Promise<void> {
  let docs = await db.collection(name).listDocuments()

  // delete in parallel
  await Promise.all(docs.map(e => e.delete()))

  return;
}

/**
 * Delete multiple collections in parallel
 * @param collections 
 * @returns 
 */
export async function deleteCollections(collections: string[]): Promise<void> {
  // delete in parallel
  await Promise.all(collections.map(e => deleteCollection(e)))
  return;
}
