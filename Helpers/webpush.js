import { admin } from "./fcmprovaider.js";


export async function webPush({
fcmToken,
  roomName,
  callerId,
  callerName,
  callType, // "voice_call" | "video_call"
  isConference=false
}) {  
    await admin.messaging().send({
        token: fcmToken,
        notification: {
          title:callType==="voice_call"? "Incoming voice Call":
          "Incoming video Call",
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
            title:callType==="voice_call"? "Incoming voice Call":
            "Incoming video Call",
            body: `${callerName} is calling you`,
            icon: "https://ixes.ai/logo.png",
          },
          fcmOptions: {
            link:callType==="voice_call"?
             `https://ixes.ai/chat?call=voice&room=${roomName}&callerId=${callerId}&callerName=${callerName}&conference=${isConference}`
            :
            `https://ixes.ai/chat?call=video&room=${roomName}&callerId=${callerId}&callerName=${callerName}`,
          },
        },
      });
      
}
