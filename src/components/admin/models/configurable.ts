import mongoose from "mongoose";
import {AppConstants} from "../../../utils/appConstants";

const mongoose_ = require('mongoose');

const configurableSchema = new mongoose_.Schema({
    chats: {
        voiceNote: {type: String, default: null},
        images: {type: String, default: null},
        files: {type: String, default: null},
        video: {type: String, default: null},
    },
    posts: {
        images: {type: String, default: null},
        video: {type: String, default: null},
    },
    ads: {
        images: {type: String, default: null},
        video: {type: String, default: null},
        audio: {type: String, default: null},
    },
    streaming: {
        video: {type: String, default: null},
        audio: {type: String, default: null},
    },
    trace : {
        traceRequest: {type: Number, default: 0}
    },
    employee: {
        employeeRequest: {type: Number, default: 10}
    }

}, {timestamps: true});

module.exports = mongoose_.model(AppConstants.MODEL_CONFIGURABLE, configurableSchema);