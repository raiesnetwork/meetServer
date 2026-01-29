import  mongoose  from'mongoose';

const UsersProfileSchema = new mongoose.Schema({
  profileImage: { type: String },
  name: { type: String },
  birthdate: { type: String },
  location: { type: String },
  address: { type: String },
  isFamilyHead: { type: Boolean },
  agreement:{type:Boolean},
  gender: { type: String },
  relation: { type: String },
  address2: { type: String },
  country: { type: String },
  state: { type: String },
  city: { type: String },
  pin: { type: String },
  location: { type: String },
});


const UserSchema = new mongoose.Schema({
  mobile: {
    type: String,
    unique: true,
    sparse: true
  },
  razorpayCustomerId: {
    type: String,
  },
  
  businessProfiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProfile' }],
  email: { type: String },
  password: { type: String, },
  memberCreatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: {
    type: String,
    enum: ['USER', 'ADMIN', 'MODERATOR','STUDENT'],
    default: 'USER',
  },
  createdBy: { type: String },
  profile: UsersProfileSchema,
  communities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserCommunity' }],
  payment: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
  madePayments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  onlinePayments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OnlinePayment' }],
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  coupons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }],
  receivedCoupons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CouponReceiver' }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Like' }],
  receivedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PostReceiver' }],
  trackers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tracker' }],
  notInterested: [{ type: mongoose.Schema.Types.ObjectId, ref: 'NotInterested' }],
  postReports: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PostReport' }],
  domainName: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubDomains' }],
  storeSubscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StoreSubscription' }],
  addedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AddProduct' }],
  storeUser: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StoreUsers' }],
  announcements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Announcements' }],
  gptSearchHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GPTSearchHistory' }],
  folders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Folder' }],
  files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
  Notification: [
    {notification: {type: mongoose.Schema.Types.ObjectId, ref: 'Notification'} ,
    read: { type: Boolean, default: false }}
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  embedding: {
    type: mongoose.Schema.Types.Mixed,
  }, resetToken: {
    type: mongoose.Schema.Types.Mixed,
  },
   resetTokenExpiry: {
    type: mongoose.Schema.Types.Mixed,
  }, weaviateId: {
    type: mongoose.Schema.Types.Mixed,
  },
  communityTypes: [
    {
      communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
      userType: { type: String }
    }
  ],
  account: [{ type: mongoose.Schema.Types.ObjectId, 
    ref: 'BankAccount' }],
    Withdrawal: [{ type: mongoose.Schema.Types.ObjectId, 
    ref: 'Withdrawal' }],
razorpayAuthData:{
  type: mongoose.Schema.Types.Mixed,
},
storeAdminId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  
},
isStorePartner:{
  type: Boolean,
  default:false
},isAdmin:{
  type: Boolean,
  default:false
},
storePartnerType:{
  type: String,
},
storePartnerRequestStatus:{
  type: String,
},
tenantProfiles: [
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
    nodes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Community" }],
    roles: [{ type: String }],
    source: { type: String }
  }
],
activeTenant: {
  tenantId: { type: mongoose.Schema.Types.ObjectId },
  role: String
},

institutionName:{
  type: String,
},
programmeName:{
  type: String,
},
fcmToken:{
  type: String,
},
platform:{
  type: String,
},
voipToken:{
  type: String,
}, 
});

const userScheema = mongoose.model('User', UserSchema);
export default userScheema;
