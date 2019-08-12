const admin = require('firebase-admin');
const functions = require('firebase-functions');

// production environment
if(process.env.GCP_PROJECT) {
    admin.initializeApp(functions.config().firebase);
}
else {
    // development environment
    let serviceAccount = require('./firebaseadminsdk.json');

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

exports.hello = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json('World!')
})

exports.catalog = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
        if(req.query.department && req.query.catalogNumber) {
            // get exact course
            let query = db.collection('catalog')
                .where('department', '==', req.query.department)
                .where('catalogNumber', '==', req.query.catalogNumber);
            let querySnap = await query.get();
            if(querySnap.empty) {
                res.status(400).json({
                    error: 'Course not found',
                    description: 'A course with those arguments could not be found'
                });
            }
            else {
                // save reference to Course
                let courseRef = querySnap.docs[0].ref;
                // Sort object keys
                let courseSnap = querySnap.docs[0].data()
                let results = {};
                Object.keys(courseSnap).sort().forEach(key => {
                    results[key] = courseSnap[key];
                });
                // secondary query for course sections
                let subquery = courseRef.collection('sections')
                    .orderBy('term', 'desc')
                    .orderBy('sectionNumber', 'asc');
                let snapshot = await subquery.get();
                let docs = snapshot.docs
                    // Extract data from snapshot
                    .map(doc => doc.data())
                    // Delete property that contains Firestore References and confidential API keys
                    .map(doc => { delete doc['instructors']; return doc; })
                    // Sort object keys (https://stackoverflow.com/a/31102605)
                    .map(doc => {
                        const ordered = {};
                        Object.keys(doc).sort().forEach(key => {
                            ordered[key] = doc[key];
                        })
                        return ordered;
                    });
                Object.assign(results, { sections: docs })
                res.json(results);
            }
        }
        else if(req.query.department) {
            // list courses from department
            let query = db.collection('catalog')
                .where('department', '==', req.query.department)
                .orderBy('catalogNumber', 'asc');
            let snapshot = await query.get();
            if(snapshot.empty) {
                res.status(400).json({
                    error: 'Department not found',
                    description: 'A department with those arguments could not be found'
                });
            }
            else {
                let docs = snapshot.docs
                    // Extract data from snapshot
                    .map(doc => doc.data())
                    // Sort object keys (https://stackoverflow.com/a/31102605)
                    .map(doc => {
                        const ordered = {};
                        Object.keys(doc).sort().forEach(key => {
                            ordered[key] = doc[key];
                        })
                        return ordered;
                    });
                res.json(docs);
            }
        }
        else {
            res.status(400).json({
                error: 'Insufficient arguments',
                description: 'Please include at least a `department` query parameter.'
            })
        }
    }
    catch(err) {
        console.log(err)
        res.status(500).json({
            error: 'Internal Server Error',
            description: 'The server has encountered a situation it doesn\'t know how to handle.'
        })
    }
})