import mongoose from "mongoose";
import {AppConstants} from "../../../utils/appConstants";


const blockUsersSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: AppConstants.MODEL_USER_PROFILE
    },
    blocked_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: AppConstants.MODEL_USER_PROFILE
    },
    deleted: {
        type: mongoose.Schema.Types.Number,
        default: 0
    }
}, {timestamps: true});

module.exports = mongoose.model(AppConstants.MODEL_BLOCKED_USERS, blockUsersSchema);