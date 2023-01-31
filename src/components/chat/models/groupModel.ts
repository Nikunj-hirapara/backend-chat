import mongoose, {Document} from "mongoose";
import {AppConstants} from "../../../utils/appConstants";

// const msgType_ = Object.values(msgType).filter(value => typeof value === 'number');

const geoTagSchema = new mongoose.Schema({
    name: String,
    address: String,
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default:'Point'
        },
        coordinates: {
            type: [Number]
        },
    },
}, {_id: false})

const groupSchema = new mongoose.Schema({
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    name: {
        type: mongoose.Schema.Types.String
    },
    image: {
        type: mongoose.Schema.Types.String
    },
    description: {
        type: mongoose.Schema.Types.String
    },
    private: {
        type: mongoose.Schema.Types.Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: AppConstants.MODEL_USER_PROFILE
    },
    userName: String,
    members: [mongoose.Schema.Types.ObjectId],
    admins: [mongoose.Schema.Types.ObjectId],
    geoTag: geoTagSchema,

}, {timestamps: true});

groupSchema.index({
    "geoTag.location": "2dsphere",    
})

module.exports = mongoose.model(AppConstants.MODEL_GROUP, groupSchema);