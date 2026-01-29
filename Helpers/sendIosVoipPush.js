// // sendIosVoipPush.js
// import apn from "apn";
// import apnProvider from "./apnsProvider.js";

// export async function sendIosVoipPush({
//   voipToken,
//   roomName,
//   callerId,
//   callerName,
//   callType, // "voice_call" | "video_call"
// }) {
//   const notification = new apn.Notification();

//   notification.topic = "com.ixes.app.voip"; // REQUIRED <YOUR_IOS_BUNDLE_ID>.voip
//   notification.pushType = "voip";
//   notification.priority = 10;

//   notification.payload = {
//     type: callType,
//     roomName,
//     callerId,
//     callerName,
//   };

//   await apnProvider.send(notification, voipToken);
// }
