import commonUtils from "../../utils/commonUtils";

const config = require("config")
import {NextFunction, Request, Response} from "express"
import {AppStrings} from "../../utils/appStrings";
import multer, {FileFilterCallback, MulterError} from 'multer'

const crypto = require("crypto");

async function DecryptedDataResponse(req: Request, res: Response, next: NextFunction) {
    try {
        if (req.body && req.body.value && req.body.value !== "") {
            //remove decrypt method from here
            next();
        } else {
            return commonUtils.sendError(req, res, {message: AppStrings.DECRYPT_DATA_IS_REQUIRED}, 400);
        }
    } catch (e) {
        return commonUtils.sendError(req, res, {
            "message": e
        })
    }
}

async function DecryptData(req: Request, res: Response, next: NextFunction) {
    if (req.method === "GET") return next()

    if (req.headers.env && req.headers.env === "demo") {
        next();
    } else {
        return DecryptedDataResponse(req, res, next);
    }
}


export default {
    DecryptedData: DecryptData
}