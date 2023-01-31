import {NextFunction, Request, Response} from "express";
import validator from "../../utils/validate";
import mongoose from "mongoose";
import commonUtils from "../../utils/commonUtils";
import {AppStrings} from "../../utils/appStrings";

const User = require("../users/models/userModel");


const addMemberValidation = async (req: Request, res: Response, next: NextFunction) => {
    const validationRule: any = {
        "groupId": "required|string",
        "userId": "required|string",
    }

    const userId = req.headers.userid as string;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
        return commonUtils.sendError(req, res, {message: AppStrings.INVALID_REQUEST}, 409);

    const user = await User.findById(userId);
    if (!user) return commonUtils.sendError(req, res, {message: AppStrings.INVALID_REQUEST}, 409);

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

export default {
    addMemberValidation
}