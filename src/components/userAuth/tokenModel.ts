import {AppConstants} from "../../utils/appConstants";
import mongoose from "mongoose";
import {Device} from "../../utils/enum";

const deviceType = Object.values(Device).filter(value => typeof value === 'number');

const Schema = mongoose.Schema;
const tokenSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "user",
    }, businessId: {
        type: Schema.Types.ObjectId,
        required: false,
        ref: "business",
    },
    otp: {
        type: String,
        required: true,
    },
    choice: {
        type: Number,
        required: false,
        default: 0
    },

    token: {
        type: String,
        required: true,
    },
    device: {
        type: Number,
        enum: deviceType,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    forSignUp: {
        type: Boolean,
        default: false,
    },
    isForgot: {
        type: Boolean,
        default: false,
    },
    requestCount: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: AppConstants.TOKEN_EXPIRY_TIME
    },
}, {timestamps: true});

module.exports = mongoose.model(AppConstants.MODEL_TOKEN, tokenSchema);