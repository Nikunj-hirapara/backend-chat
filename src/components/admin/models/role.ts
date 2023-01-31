import mongoose from "mongoose";
import { AppConstants } from "../../../utils/appConstants";
import {PermissionModule} from "../../../utils/enum";
const mongoose_ = require('mongoose');

const RoleSchema = new mongoose_.Schema({
    name:{
        type: String,
        required: true,
    },
    permission:{
        users:{
            type: String,
            default: "00000"
        },
        category:{
            type: String,
            default: "00000"
        },
        sub_admin:{
            type: String,
            default: "00000"
        },
        trust_level:{
            type: String,
            default: "00000"
        },
        roles:{
            type: String,
            default: "00000"
        },
        trace_request:{
            type: String,
            default: "00000"
        },
        trace_history:{
            type: String,
            default: "00000"
        },
        configurable_fields:{
            type: String,
            default: "00000"
        },
        business_request:{
            type: String,
            default: "00000"
        }
    }
}, { timestamps: true });

module.exports = mongoose_.model(AppConstants.MODEL_ROLE, RoleSchema);