const admin = require("firebase-admin")

admin.initializeApp()

const firebaseMessaging = admin.messaging()
export { firebaseMessaging }
