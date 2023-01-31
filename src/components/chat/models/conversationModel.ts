import mongoose from "mongoose";

import {AppConstants} from "../../../utils/appConstants";
import moment from "moment";
import {convType} from "../../../utils/enum";

const ConvType_ = Object.values(convType).filter(value => typeof value === 'number');

const conversationSchema = new mongoose.Schema({
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
    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: AppConstants.MODEL_BUSINESS
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: AppConstants.MODEL_GROUP
    },
    businessUserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: AppConstants.MODEL_USER_PROFILE
    },
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        // unique: true,
    },
    clearedAt: {
        type: mongoose.Schema.Types.Number
    },
    type: {
        type: Number,
        required: true,
        enum: ConvType_
    },
    pin: {
        type: mongoose.Schema.Types.Boolean
    },
    mute: {
        type: mongoose.Schema.Types.Boolean
    },
    deleted: {
        type: mongoose.Schema.Types.Boolean
    },
    active: {
        type: mongoose.Schema.Types.Boolean
    },
    employee: [mongoose.Schema.Types.ObjectId],
}, {timestamps: true});


conversationSchema.virtual('createdDate').get(function (this: { createdAt: Date }) {
    return moment(this.createdAt).valueOf()
})

conversationSchema.virtual('updatedDate').get(function (this: { updatedAt: Date }) {
    return moment(this.updatedAt).valueOf()
})


module.exports = mongoose.model(AppConstants.MODEL_CONVERSATION, conversationSchema);