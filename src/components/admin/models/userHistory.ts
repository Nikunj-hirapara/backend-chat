import mongoose from "mongoose";
import { AppConstants } from "../../../utils/appConstants";

const mongoose_ = require('mongoose');

const userHistorySchema = new mongoose_.Schema({
    userData: {
       type: Object,
       require: false
    }
}, { timestamps: true });

module.exports = mongoose_.model(AppConstants.MODEL_USER_HISTORY, userHistorySchema);