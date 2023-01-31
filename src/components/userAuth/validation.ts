import {NextFunction, Request, Response} from "express"
import validator from "../../utils/validate";
import commonUtils from "../../utils/commonUtils";
import {Device, UserData, UserType, TermsCondition} from "../../utils/enum";
import {AppStrings} from "../../utils/appStrings";

async function loginValidation(req: Request, res: Response, next: NextFunction) {
    const devices = [Device.ANDROID, Device.IOS, Device.WEB];
    const email = UserData.EMAIL.toString();
    const mobile = UserData.MOBILE.toString();

    const validationRule: any = {
        "userName": "required",
        "password": "required|min:4|max:50",
        "pushToken": "required|string",
        "device": "required|in:" + devices.join(","),
    }

    validationRule[`userName.${email}`] = "string|email|max:255|must_from:User,email";
    validationRule[`userName.${mobile}`] = "valid_phone|must_from:User,mobile";

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

async function registerValidation(req: Request, res: Response, next: NextFunction) {
    const email = UserData.EMAIL.toString();
    const mobile = UserData.MOBILE.toString();
    const devices = [Device.ANDROID, Device.IOS, Device.WEB];
    const termscondition = [TermsCondition.YES];
    const validationRule: any = {
        "device": "required|in:" + devices.join(","),
        "password": "required|min:4|max:50",
        "fullName": "required|string|min:3|max:255",
        "terms": "required|in:" + termscondition.join(","),
        "userName": "required",
    }

    validationRule[`userName.${email}`] = "string|email|max:255|exist:User,email";
    validationRule[`userName.${mobile}`] = "valid_phone|exist:User,mobile|exist:User,optionalMobile.secondary|exist:User,optionalMobile.alternative";

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

async function userValidation(req: Request, res: Response, next: NextFunction) {
    const username = UserData.USERNAME.toString();
    const email = UserData.EMAIL.toString();
    const mobile = UserData.MOBILE.toString();

    const validationRule = {
        "username": {
            [username]: "string|min:3|max:255|exist:User,userName",
            [email]: "required|string|email|max:255|exist:User,email",
            [mobile]: "numeric|min:10|exist:User,mobile",
        }
    }
    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

async function verifyOTPValidation(req: Request, res: Response, next: NextFunction) {
    const email = UserData.EMAIL.toString();
    const mobile = UserData.MOBILE.toString();
    const devices = [Device.ANDROID, Device.IOS, Device.WEB];

    const validationRule = {
        "userName": {
            [email]: "string|email|max:255",
            [mobile]: "string|min:10",
        },
        "otp": "string",
        "device": "required|in:" + devices.join(","),
    }

    if (req.body.userName.email) {
        validationRule.otp = "required"
    }

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

async function OTPValidation(req: Request, res: Response, next: NextFunction) {
    const email = UserData.EMAIL.toString();
    const mobile = UserData.MOBILE.toString();
    const devices = [Device.ANDROID, Device.IOS, Device.WEB];
    const validationRule = {
        "userName": {
            [email]: "string|email|max:255",
            [mobile]: "string|min:10",
        },
        "device": "required|in:" + devices.join(","),
    }

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

async function tokenValidation(req: Request, res: Response, next: NextFunction) {
    const devices = [Device.ANDROID, Device.IOS, Device.WEB];
    const validationRule = {
        "token": "required|string",
        "device": "required|in:" + devices.join(","),
    }

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);

}

async function forgotPasswordValidation(req: Request, res: Response, next: NextFunction) {
    const validationRule = {
        "password": "required|min:4|max:50",
        "confirmPassword": "required|min:4|max:50|same:password",
    }

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

async function changePasswordValidation(req: any, res: any, next: NextFunction) {
    if (req.headers.userid === undefined)
        return commonUtils.sendError(req, res, {message: AppStrings.USERID_MISSING}, 409);

    const validationRule = {
        "old_password": "required|min:4|max:50",
        "new_password": "required|min:4|max:50|different:old_password",
    }

    validator.validatorUtilWithCallback(validationRule, {"different.new_password": "New password and old Password must be diffrent"}, req, res, next);
}

async function changeReqValidation(req: Request, res: Response, next: NextFunction) {
    const devices = [Device.ANDROID, Device.IOS, Device.WEB];
    const email = UserData.EMAIL.toString();
    const mobile = UserData.MOBILE.toString();
    const userName = UserData.USERNAME.toString();

    const validationRule: any = {
        "userName": "required",
        "device": "required|in:" + devices.join(","),
    }

    validationRule[`userName.${userName}`] = "string|max:255";
    validationRule[`userName.${email}`] = "string|email|max:255|exist:User,email";
    validationRule[`userName.${mobile}`] = "valid_phone|exist:User,mobile|exist:User,optionalMobile.secondary|exist:User,optionalMobile.alternative";

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);
}

async function changeReqOptionalValidation(req: Request, res: Response, next: NextFunction) {
    const devices = [Device.ANDROID, Device.IOS, Device.WEB];
    const mobile = UserData.MOBILE.toString();

    const validationRule: any = {
        "userName": "required",
        "device": "required|in:" + devices.join(","),
        "mobileType": "required|in:1,2"
    }

    validationRule[`userName.${mobile}`] = "valid_phone|exist:User,mobile|exist:User,optionalMobile.secondary|exist:User,optionalMobile.alternative";

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);
}


export default {
    loginValidation,
    registerValidation,
    userValidation,
    OTPValidation,
    verifyOTPValidation,
    tokenValidation,
    forgotPasswordValidation,
    changePasswordValidation,
    changeReqValidation,
    changeReqOptionalValidation
}