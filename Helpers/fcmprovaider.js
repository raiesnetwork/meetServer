import admin from "firebase-admin";
import serviceAccount from "./firebase-service.json" assert { type: "json" };
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
export {admin}