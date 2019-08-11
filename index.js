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

//let db = admin.firestore();

exports.hello = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json('World!')
})