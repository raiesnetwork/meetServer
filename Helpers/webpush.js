import { admin } from "./fcmprovaider.js";


export async function webPush({
fcmToken,
  roomName,
  callerId,
  callerName,
  callType, // "voice_call" | "video_call"
}) {
    await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "Incoming Call",
          body: `${callerName} is calling you`,
        },
        data: {
          type: callType,
          roomName,
          callerId,
          callerName,
        },
        webpush: {
          notification: {
            title: "Incoming  Call",
            body: `${callerName} is calling you`,
            icon: "https://ixes.ai/logo.png",
          },
          fcmOptions: {
            link: `https://ixes.ai/chat`,
          },
        },
      });
      
}
