import apn from "apn";

const apnProvider = new apn.Provider({
  token: {
    key: "./AuthKey_XXXX.p8",
    keyId: process.env.APN_KEY_ID,
    teamId: process.env.APN_TEAM_ID,
  },
  production: false, // true for App Store
});

export default apnProvider;
