import mongoose, {Document} from "mongoose";
import {convType, MessageStatusEnum, MsgType} from "../../../utils/enum";
import {AppConstants} from "../../../utils/appConstants";

const msgType_ = Object.values(MsgType).filter(value => typeof value === 'number');
const MessageStatusEnum_ = Object.values(MessageStatusEnum).filter(value => typeof value === 'number');
const ConvType_ = Object.values(convType).filter(value => typeof value === 'number');

const geoTagSchema = new mongoose.Schema({
    name: String,
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number]
        },
    },
}, {_id: false})


const chatSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: AppConstants.MODEL_USER_PROFILE
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: AppConstants.MODEL_USER_PROFILE
    },
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    businessUserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: AppConstants.MODEL_USER_PROFILE
    },
    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
    },
    message: {
        type: String,
        required: true
    },
    mId: {
        type: String,
        required: true
    },
    msgType: {
        type: Number,
        enum: msgType_,
        required: true
    },
    convType: {
        type: Number,
        required: true,
        enum: ConvType_
    },
    geoTag: geoTagSchema,
    readStatus: {
        type: Number,
        required: true,
        enum: MessageStatusEnum_
    },
    deletedStatus: {
        type: Number,
        required: true,
        default: false
    },
    isForwarded: {
        type: mongoose.Schema.Types.Boolean,
        required: false,
        default: false
    }
}, {timestamps: true});

module.exports = mongoose.model(AppConstants.MODEL_CHAT, chatSchema);