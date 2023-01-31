import mongoose from "mongoose";
import { AppConstants } from "../../utils/appConstants";

const NotificationSchema = new mongoose.Schema(
    {
        userId: mongoose.Schema.Types.ObjectId,
        notification: {
            title: String,
            body: String,
        },
        data: Object,
        senderId:mongoose.Schema.Types.ObjectId,
        businessId:mongoose.Schema.Types.ObjectId,
        isRead: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model(AppConstants.MODEL_NOTIFICATION, NotificationSchema);
