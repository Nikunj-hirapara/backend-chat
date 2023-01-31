import mongoose from "mongoose";
import {AppConstants} from "../../../utils/appConstants";


const userProfileSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
    },
    name: {
        type: String,
        required: false,
        min: 3,
    },
    image: {
        type: String,
        required: false,
    },
    // usertype: {
    //     type: Number,
    //     require: true,
    //     immutable: true
    // },
}, {timestamps: true});

module.exports = mongoose.model(AppConstants.MODEL_USER_PROFILE, userProfileSchema);