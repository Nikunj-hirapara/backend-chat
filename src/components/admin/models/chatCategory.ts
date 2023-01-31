import mongoose from "mongoose";
import { AppConstants } from "../../../utils/appConstants";

const mongoose_ = require('mongoose');

const chatCategorySchema = new mongoose_.Schema({
    name: {
        type: String,
        require: true,
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: AppConstants.MODEL_CATEGORY,
        require: true,
    },
    isActive: {
        type: Boolean,
        require: false,
        default: true,
    },
}, { timestamps: true });

module.exports = mongoose_.model(AppConstants.MODEL_CHAT_CATEGORY, chatCategorySchema);