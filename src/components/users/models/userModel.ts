import mongoose from "mongoose";
import {AppConstants} from "../../../utils/appConstants";
import {Device, Recognise, TrustStatus} from "../../../utils/enum";

const trustStatus = Object.values(TrustStatus).filter(value => typeof value === 'number');
const deviceType = Object.values(Device).filter(value => typeof value === 'number');
const recognise = Object.values(Recognise).filter(value => typeof value === 'number');

const addressSchema = new mongoose.Schema({
    name: String,
    // address: String,
    location: {
        type: {
            type: String,
            enum: ['Point']
        },
        coordinates: {
            type: [Number]
        },
    },
}, {_id: false})


const contactSchema = new mongoose.Schema({
    name: String,
    image: String,
    id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: AppConstants.MODEL_USER
    }
}, {_id: false})

const permissionSchema = new mongoose.Schema({
    location: {
        whileUsingApp: {
            type: Boolean,
            default: false
        },
        withLinkedContact: {
            type: Boolean,
            default: false
        },
        withPublic: {
            type: Boolean,
            default: true
        },
        notShared: {
            type: Boolean,
            default: false
        }
    },
    visibility: {
        picture: {
            type: Boolean,
            default: true
        },
        status: {
            type: Boolean,
            default: true
        },
        post: {
            type: Boolean,
            default: true
        },
        designation: {
            type: Boolean,
            default: true
        }
    },
    acceptMessage: {
        public: {
            type: Boolean,
            default: true
        },
        contact: {
            type: Boolean,
            default: true
        },
        marketing: {
            type: Boolean,
            default: true
        },
    },
}, {_id: false})

const reference = new mongoose.Schema({
    id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: AppConstants.MODEL_USER
    },
    isEndorsed: {
        type: Number,
        enum: recognise
    }
}, {_id: false})

const employeeSchema = new mongoose.Schema({
    _id: {
        type: mongoose.Schema.Types.ObjectId
    },
    businessId: {
        type: mongoose.Schema.Types.ObjectId
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId
    },
    designation: String,
    workHours: {
        startTime: Date,
        endTime: Date
    },
    workDays:[String],
    trustLevel: Number,
}, {_id: false})

const userSchema = new mongoose.Schema({
        userName: {
            type: String,
            require: true,
            min: 6,
            max: 255,
        },
        fullName: String,
        document: {
            idNumber: String,
            image: String,
            // idVerifySelfie: String,
            secondaryNumber: String,
            country: String,
            docType: Number,
            idVerifyByAdmin: Boolean, //admin update
            imageVerifyByAdmin: Boolean, //admin update,
            gender: {
                type: Number
            },
            docName: {
                type: String,
                require: false
            },
            dateOfBirth: {
                type: Date
            },
            parentId: {
                type: String,
                require: false
            },
            isVerify: {
                type: Number,
            }
        },
        bio: String,
        mobile: {
            type: String,
            require: false,
        },
        optionalMobile: {
            secondary: String,
            alternative: String
        },
        userStatus: {
            type: String,
        },
        email: {
            type: String,
            require: false,
            unique: false,
            lowercase: true,
            trim: true,
        },
        reference: [reference],
        image: {
            profilePic: String,
            userImage: String,
            chatImage: String,
        },
        address: addressSchema,  
        tempAddress: addressSchema,
        temporaryAddress: addressSchema,
        permissions: permissionSchema,
        password: {
            type: String,
            require: true,
        },
        status: {
            type: Number,
            require: true,
            default: 1
        },
        device: {
            type: Number,
            enum: deviceType,
        },
        pushToken: {
            type: String,
            require: false,
        },
        isVerify: {
            type: Number,
            require: false,
            default: 0,
        },
        lastLogin: {
            type: Date,
            default: Date.now,
        },
        averageRating: {
            stars: {
                type: Number,
                default: 0,
            },
            commentCount: {
                type: Number,
                default: 0,
            },
        },
        contacts: [contactSchema],
        trustLevel: {
            image: {type: Number, enum: trustStatus, default: TrustStatus.PENDING},
            id: {type: Number, enum: trustStatus, default: TrustStatus.PENDING},
            reference: {type: Number, enum: trustStatus, default: TrustStatus.PENDING},
            address: {type: Number, enum: trustStatus, default: TrustStatus.PENDING}
        },
        averageTrust: Number,
        userTrace: {
            type: Number,
            // default: 4
        },
        isProfileComplete: {
            type: Number,
            default: 0,
            required: false,
        },
        endDate: {
            type: Date,
            default: null
        },
        isUserRejected: {
            type: Number,
            default: 0
        },
        idVerifySelfie: String,
        employee: employeeSchema,
        addressDate: {
            type: Date,
            default: null
        },
        HomeAddressDate: {
            type: Date,
            default: null
        },
        isDeleted: {
            type: Number,
            default: 0
        },
        isMark: {
            type: Number,
            default: 0
        },
        firebaseUid : {
            type: String,
            default: null
        },
        selfieUpdateAt: {
            type: Date,
            default: null
        },
        documentUpdateCount:{
            type:Number,
            default:0
        }
    },
    {timestamps: true}
);

userSchema.index({
    "tempAddress.location": "2dsphere",
})

userSchema.statics.getPushToken = async function (userId:any) {
    const data = await this.findById(userId);
    return data?.pushToken ?? null
}

module.exports = mongoose.model(AppConstants.MODEL_USER, userSchema);