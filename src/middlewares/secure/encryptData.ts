import crypto from "crypto";
import {Request, Response} from "express"
import commonUtils from "../../utils/commonUtils";
const config = require("config")
async function encryptedDataResponse(data: any) {
     // remove code from here
    return {
        data
    }
}

async function EncryptData(req: Request, res: Response, data: any) {
    if (req.headers.env && req.headers.env === "demo") {
        return data;
    } else {
        return await encryptedDataResponse(data);
    }
}
export default {
    EncryptedData: EncryptData,
    encryptedDataResponse: encryptedDataResponse
}
