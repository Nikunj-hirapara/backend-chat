import mongoose from "mongoose";
import { AppConstants } from "../../../utils/appConstants";

const mongoose_ = require('mongoose');

const categorySchema = new mongoose_.Schema({
    name: {
        type: String,
        require: false,
    },
    image:String,
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        require: false,
        default: null,
    },
    isActive: {
        type: Boolean,
        require: false,
        default: true,
    },
}, { timestamps: true });

module.exports = mongoose_.model(AppConstants.MODEL_CATEGORY, categorySchema);