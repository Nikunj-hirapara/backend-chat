import { NextFunction, Request, Response } from "express"
import validator from "../../utils/validate";
import commonUtils from "../../utils/commonUtils";
import { Gender } from "../../utils/enum";
import { AppStrings } from "../../utils/appStrings";
import mongoose from "mongoose";

const User = require('./models/userModel');


const hasUserValidation = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.headers.userid as string;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
        return commonUtils.sendError(req, res, { message: AppStrings.USERID_MISSING }, 404);

    const user = await User.findById(userId);
    if (!user) return commonUtils.sendError(req, res, { message: AppStrings.USER_NOT_FOUND }, 409);

    next();
}

const locationValidation = async (req: Request, res: Response, next: NextFunction) => {

    const ValidationRule: any = {
        "location": {
            "longitude": "required|numeric|min:-180|max:180",
            "latitude": "required|numeric|min:-90|max:90",
        },
    }
    validator.validatorUtilWithCallback(ValidationRule, {}, req, res, next);
}
const settingProfileValidation = async (req: Request, res: Response, next: NextFunction) => {

    const ValidationRule: any = {
        "location": {
            "whileUsingApp": "boolean",
            "withLinkedContact": "boolean",
            "withPublic": "boolean",
            "notShared": "boolean",
        },
        "visibility": {
            "picture": "boolean",
            "status": "boolean",
            "post": "boolean",
        },
        "acceptMessage": {
            "public": "boolean",
            "contact": "boolean",
            "marketing": "boolean"
        }
    }
    validator.validatorUtilWithCallback(ValidationRule, {}, req, res, next);
}

const complateProfileValidation = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.headers.userid;
    const validationRule: any = {
        "bio": "required|string",
        "userStatus": "required|string",
        "fullName": "required|string",
        "userName": `required|string|exist_value:User,userName,${userId}`,
        "mobile": `valid_phone|exist_value:User,mobile,${userId}`,
        "email": `string|email|max:255|exist_value:User,email,${userId}`,
        "secondary": `valid_phone|different:mobile|different:alternative|exist_value:User,mobile,${userId}|exist_value:User,optionalMobile.secondary,${userId}|exist_value:User,optionalMobile.alternative,${userId}`,
        "alternative": `valid_phone|different:mobile|different:secondary|exist_value:User,mobile,${userId}|exist_value:User,optionalMobile.secondary,${userId}|exist_value:User,optionalMobile.alternative,${userId}`,
        // "address": "required",
        // "address.name": "required",
        // "address.longitude": "required|numeric|min:-180|max:180",
        // "address.latitude": "required|numeric|min:-180|max:180",
    }

    validator.validatorUtilWithCallback(validationRule, {}, req, res, next);

}

/** Ignored */
const refrenceValidation = async (req: Request, res: Response, next: NextFunction) => {
    const validationRule = {
        "reference.*.name": "required|string",
        "reference.*.email": "required|email|different:reference.*.email",
        "reference.*.mobile": "required|valid_phone|different:reference.*.mobile",
    }

    const uniqueMobile = [...new Set(req.body.map((item: any) => item.mobile))];
    if (uniqueMobile.length !== req.body.length) return commonUtils.sendError(req, res, {
        errors: {
            "mobile": AppStrings.MOBILE_SHOULD_BE_UNIQUE
        }
    })

    const uniqueEmail = [...new Set(req.body.map((item: any) => item.email))];
    if (uniqueEmail.length !== req.body.length) return commonUtils.sendError(req, res, {
        errors: {
            "email": AppStrings.EMAIL_SHOULD_BE_UNIQUE
        }
    })

    validator.validatorUtil({ reference: req.body }, validationRule, {}, (err: any, success: any) => {
        if (err) {
            return commonUtils.sendError(req, res, { errors: commonUtils.formattedErrors(err) })
        }
        if (success) {
            next()
        }
    })
}

//TODO: is your primary number link with document number [checkbox]
const documentProfileValidation = async (req: Request, res: Response, next: NextFunction) => {
    const gender = [Gender.MALE, Gender.FEMALE, Gender.TRANSGENDER, Gender.NON_BINARY, Gender.OTHER];
    const userId = req.headers.userid;
    const idNumber = req.body.idNumber;
    const ValidationRule = {
        "idNumber": "string",
        "image": "string",
        // "idVerifySelfie": "string",
        "secondaryNumber": `valid_phone|exist_value:User,mobile,${userId}|exist_value:User,optionalMobile.secondary,${userId}|exist_value:User,optionalMobile.alternative,${userId}`,
        "countryCode": "string|required",
        "documentType": "numeric|required",
        "gender": "required|in:" + gender.join(","),
    }
    if (idNumber) {
        ValidationRule.image = "required"
    }

    validator.validatorUtilWithCallback(ValidationRule, {}, req, res, next);
}

const traceUserAccpted = async (req: Request, res: Response, next: NextFunction) => {
    let ValidationRule: any = {
        "status": "required|in:1,2"
    }
    validator.validatorUtilWithCallback(ValidationRule, {}, req, res, next);
}

const inactiveValidation = async (req: Request, res: Response, next: NextFunction) => {

    const ValidationRule: any = {
        "status": "required|in:0,1",
    }
    if (req.body.status == 0) {
        ValidationRule.endDate = "required"
    }
    validator.validatorUtilWithCallback(ValidationRule, {}, req, res, next);
}

const verifySelfie = async (req: Request, res: Response, next: NextFunction) => {

    const ValidationRule: any = {
        "idVerifySelfie": "required",
    }

    validator.validatorUtilWithCallback(ValidationRule, {}, req, res, next);
}

const homeAddressValidation = async (req: Request, res: Response, next: NextFunction) => {

    let tempAddress = req.body?.tempAddress;
    const ValidationRule: any = {
        "address": {
            "name": "required",
            "longitude": "required",
            "latitude": "required",
        },
        "tempAddress": {
            "name": "string",
            "longitude": "numeric",
            "latitude": "numeric",
        }
    }
    if (tempAddress?.name) {
        ValidationRule.tempAddress.longitude = "required"
        ValidationRule.tempAddress.latitude = "required"
    }

    validator.validatorUtilWithCallback(ValidationRule, {}, req, res, next);
}

const DeleteRequestValidation = async (req: Request, res: Response, next: NextFunction) => {

    const ValidationRule: any = {
        "reason": "required",
        "status": "required|in:0,1"  // 0 user, 1 business
    }
    if (req.body.status == 1) {
        ValidationRule.businessId = "required"
    }
    validator.validatorUtilWithCallback(ValidationRule, {}, req, res, next);
}

//TODO: Face and figur varification(trust leval)
const VerificationValidation = async (req: Request, res: Response, next: NextFunction) => {

    const ValidationRule: any = {
        "status": "required|in:1,2,3",
    }

    validator.validatorUtilWithCallback(ValidationRule, {}, req, res, next);
}


export default {
    hasUserValidation,
    locationValidation,
    complateProfileValidation,
    settingProfileValidation,
    documentProfileValidation,
    refrenceValidation,
    traceUserAccpted,
    inactiveValidation,
    verifySelfie,
    homeAddressValidation,
    DeleteRequestValidation,
    VerificationValidation

}