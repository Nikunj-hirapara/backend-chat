import {Request, Response} from "express";
import commonUtils from "../utils/commonUtils";
import aes from "../utils/aes";
import redisClient from "../utils/redisHelper";
import mongoose from "mongoose";
import {Device, ReportType, UserType} from "../utils/enum";
import {AppStrings} from "../utils/appStrings";

const User = require('../components/users/models/userModel')
const jwt = require('jsonwebtoken');
const config = require("config");
type ObjectId = mongoose.Schema.Types.ObjectId;

const login = async (userId: any, userType: UserType, createdAt: String, device: number, isGuest: Boolean = false) => {
    try {
        let uniqueUserKey = aes.encrypt(
            JSON.stringify(device !== Device.WEB ? {
                "userId": userId,
                "userType": userType,
                "createdAt": createdAt,
                "isGuest": isGuest
            } : {
                "userId": userId,
                "userType": userType,
                "createdAt": createdAt,
                "device": device,
                "isGuest": isGuest
            }), config.get("OUTER_KEY_USER"))

        let payload = aes.encrypt(uniqueUserKey, config.get("OUTER_KEY_PAYLOAD"))

        const accessToken = jwt.sign({sub: payload}, config.get("JWT_ACCESS_SECRET"), {expiresIn: config.get("JWT_ACCESS_TIME")});

        const refreshToken = await generateRefreshToken(payload);

        let data = {accessToken: accessToken, refreshToken: refreshToken, loginTime: new Date().toUTCString()}

        if (device !== Device.WEB) {
            const oldValue = await redisClient.get("m_" + uniqueUserKey.toString())
            if (oldValue) {
                await redisClient.lpush('BL_' + uniqueUserKey.toString(), JSON.parse(oldValue).accessToken);
            }
            await redisClient.set("m_" + uniqueUserKey.toString(), JSON.stringify(data))
        } else {
            await redisClient.lpush("w_" + uniqueUserKey.toString(), JSON.stringify(data));
        }
        return data;
    } catch (error: any) {
        console.log(error.message);

        return error.message
    }

}

const logout = async (req: any, res: Response) => {
    let userId = req.headers.userid

    const tokens_ = req.headers?.authorization?.split(' ') ?? []

    if (tokens_.length <= 1) {
        return commonUtils.sendError(req, res, {message: AppStrings.INVALID_TOKEN}, 403);
    }
    const token = tokens_[1];
    var decoded = jwt.decode(token);
    if (!decoded?.sub) {
        return commonUtils.sendError(req, res, {message: AppStrings.INVALID_TOKEN}, 403);
    }

    const uniqueUserKey = aes.decrypt(decoded.sub, config.get("OUTER_KEY_PAYLOAD"))
    const userData = JSON.parse(aes.decrypt(uniqueUserKey, config.get("OUTER_KEY_USER")));

    if (userData?.device !== Device.WEB) {
        const oldValue = await redisClient.get("m_" + uniqueUserKey.toString())

        if (oldValue) {
            let exists = JSON.parse(oldValue).accessToken === token
            if (exists) await redisClient.lpush('BL_' + uniqueUserKey.toString(), JSON.parse(oldValue).accessToken);

            await redisClient.del("m_" + uniqueUserKey.toString())
        }

    } else {
        let tokens: [] = await redisClient.lrange("w_" + uniqueUserKey.toString(), 0, -1)

        let index = tokens.findIndex(value => JSON.parse(value).accessToken.toString() === token.toString())

        // remove the refresh token
        await redisClient.lrem("w_" + uniqueUserKey.toString(), 1, await redisClient.lindex("w_" + uniqueUserKey.toString(), index));
        // blacklist current access token
        await redisClient.lpush('BL_' + uniqueUserKey.toString(), token);
    }

    await User.findByIdAndUpdate(userId, { $set: { pushToken: null } })

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return commonUtils.sendSuccess(req, res, {}, 204);
}

const getAccessTokenPromise = async (oldToken: any) => {
    return new Promise((resolve, reject) => {
        jwt.verify(oldToken, config.get("JWT_REFRESH_SECRET"), async (err: any, user: any) => {
            if (err) {
                return reject({status: 401});
            } else {
                const uniqueUserKey = aes.decrypt(user.sub, config.get("OUTER_KEY_PAYLOAD"))

                const userData = JSON.parse(aes.decrypt(uniqueUserKey, config.get("OUTER_KEY_USER")));

                if (userData.isGuest) reject({error: AppStrings.NOT_FOR_GUEST, status: 401})

                if (userData?.device !== Device.WEB) {
                    let oldValue = await redisClient.get("m_" + uniqueUserKey.toString())

                    let exists

                    if (oldValue) {
                        exists = JSON.parse(oldValue)?.refreshToken === oldToken
                    }

                    if (!exists){
                        return reject({error: AppStrings.INVALID_TOKEN, status: 401})
                    } else{
                        let payload = aes.encrypt(uniqueUserKey.toString(), config.get("OUTER_KEY_PAYLOAD"))

                        const accessToken = jwt.sign({sub: payload}, config.get("JWT_ACCESS_SECRET"), {expiresIn: config.get("JWT_ACCESS_TIME")});
                        const refreshToken = await generateRefreshToken(payload);


                        let data = {accessToken: accessToken, refreshToken: refreshToken, loginTime: new Date().toUTCString()}


                        await redisClient.set("m_" + uniqueUserKey.toString(), JSON.stringify(data))

                        return resolve(data)
                    }


                } else {
                    let tokens: [] = await redisClient.lrange("w_" + uniqueUserKey.toString(), 0, -1)
                    let index = tokens.findIndex(value => JSON.parse(value).refreshToken.toString() === oldToken.toString())

                    if (index === -1) reject({error: AppStrings.INVALID_TOKEN, status: 403})

                    let payload = aes.encrypt(uniqueUserKey.toString(), config.get("OUTER_KEY_PAYLOAD"))

                    const accessToken = jwt.sign({sub: payload}, config.get("JWT_ACCESS_SECRET"), {expiresIn: config.get("JWT_ACCESS_TIME")});
                    const refreshToken = await generateRefreshToken(payload);

                    let data = {accessToken: accessToken, refreshToken: refreshToken, loginTime: new Date().toUTCString()}

                    await redisClient.lset("w_" + uniqueUserKey.toString(), index, JSON.stringify(data));

                    return resolve(data)
                }
            }
        })
    })
}

const checkSession = async (userId: ObjectId, userType: UserType, createdAt: Date, device: number, isGuest: Boolean = false) => {
    let uniqueUserKey = aes.encrypt(
        JSON.stringify(device !== Device.WEB ? {
            "userId": userId,
            "userType": userType,
            "createdAt": createdAt,
            "isGuest": isGuest
        } : {
            "userId": userId,
            "userType": userType,
            "createdAt": createdAt,
            "device": device,
            "isGuest": isGuest
        }), config.get("OUTER_KEY_USER"))

    const oldValue = await redisClient.get("m_" + uniqueUserKey.toString())

    if (device !== Device.WEB && oldValue) {
        return [null, AppStrings.TERMINATE_ANOTHER_MOBILE_SESSION]
    }

    return [true, null];
}

const getAccessToken = async (req: any, res: Response) => {
    const tokens_ = req.headers?.authorization?.split(' ') ?? []
    if (tokens_.length <= 1) {
        return commonUtils.sendError(req, res, {message: AppStrings.INVALID_TOKEN}, 401);
    }
    const oldToken = tokens_[1];
    getAccessTokenPromise(oldToken).then((result: any) => {
        const {refreshToken, accessToken} = result
        res.cookie("accessToken", accessToken, {maxAge: 900000, httpOnly: true});
        res.cookie("refreshToken", refreshToken, {maxAge: 900000, httpOnly: true});
        return commonUtils.sendSuccess(req, res, {});
    }).catch((err: any) => {
        return commonUtils.sendAdminError(req, res, {message: err?.error}, err.status)
    })
}


const getWebRefreshToken = async (req: any, res: Response) => {
    const {refreshToken} = req.cookies;
    if (!refreshToken) return res.sendStatus(403);

    getAccessTokenPromise(refreshToken).then((result: any) => {
        const {refreshToken, accessToken} = result
        res.cookie("refreshToken", refreshToken, {httpOnly: true, secure: true, maxAge: 24 * 60 * 60 * 1000});
        return commonUtils.sendAdminSuccess(req, res, {accessToken})
    }).catch((err: any) => {
        return commonUtils.sendError(req, res, {message: err?.error}, err.status)
    })
}

const getAdminRefreshToken = async (req: any, res: Response) => {
    const {refreshToken} = req.cookies;
    if (!refreshToken) return res.sendStatus(403);

    getAccessTokenPromise(refreshToken).then((result: any) => {
        const {refreshToken, accessToken} = result
        res.cookie("refreshToken", refreshToken, {httpOnly: true, secure: true, maxAge: 24 * 60 * 60 * 1000});
        return commonUtils.sendAdminSuccess(req, res, {accessToken})
    }).catch((err: any) => {
        return commonUtils.sendAdminError(req, res, {message: err?.error}, err.status)
    })
}

const generateRefreshToken = async (payload: string) => {
    return jwt.sign({sub: payload}, config.get("JWT_REFRESH_SECRET"), {expiresIn: config.get("JWT_REFRESH_TIME")});
}

export default {
    login,
    logout,
    getAccessToken,
    checkSession,
    generateRefreshToken,
    getAdminRefreshToken,
    getWebRefreshToken
}