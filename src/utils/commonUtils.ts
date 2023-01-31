import { AppConstants } from "./appConstants";
import moment from "moment";
import { NextFunction, Request, Response } from "express";
import encryptedData from "../middlewares/secure/encryptData";
import multer, { FileFilterCallback } from 'multer'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void
const path = require('path')
const Notification = require('../components/notification/notificationModel');
const User = require('../components/users/models/userModel');
const os = require('os')
const md5 = require("md5");
import decryptedData from "../middlewares/secure/decryptData";
import verifyToken from "../middlewares/validations";
import { groupEvents, MicroComponent, NotificationType } from "./enum";
import { firebaseMessaging } from "../components/notification/firebase";
import mongoose from "mongoose";
const getRootDir = () => path.parse(process.cwd()).root
const getHomeDir = () => os.homedir()
const getPubDir = () => "./public"
// const { getAuth } = require('firebase-admin/auth');

function formatDate(date: any) {
    return moment(date).format(AppConstants.DATE_FORMAT)
}

async function sendSuccess(req: Request, res: Response, data: any, statusCode = 200) {
    if (req.headers.env === "demo") {
        return res.status(statusCode).send(data)
    }

    let encData = await encryptedData.EncryptedData(req, res, data)
    return res.status(statusCode).send(encData)
}

async function sendAdminSuccess(req: Request, res: Response, data: any, statusCode = 200) {
    return res.status(statusCode).send(data)
}

async function sendAdminError(req: Request, res: Response, data: any, statusCode = 422) {
    return res.status(statusCode).send(data)
}

async function sendError(req: Request, res: Response, data: any, statusCode = 422) {
    if (req.headers.env === "demo") {
        return res.status(statusCode).send(data)
    }

    // let encData = await encryptedData.EncryptedData(req, res, data)
    return res.status(statusCode).send(data)
}

function getCurrentUTC(format = AppConstants.DATE_FORMAT, addMonth: any = null, addSeconds: number = 0) {
    // console.log(moment.utc(new Date()).format("YYYY-MM-DD HH:mm:ss"));
    if (addMonth != null) {
        return moment.utc(new Date()).add(addMonth, 'M').format(format);
    } else if (addSeconds > 0) {
        return moment.utc(new Date()).add(addSeconds, 'seconds').format(format);
    } else {
        return moment.utc(new Date()).add().format(format);
    }
}

function getNext1MonthDate(format = AppConstants.DATE_FORMAT) {
    return moment.utc(new Date()).add(1, 'M').format(format)
}

function getNext3DaysDate(value: moment.Moment, format = AppConstants.DATE_FORMAT) {
    return value.add(4, 'd').format(format)
}

function getNext1MonthDateWithDate(value: Date, format = AppConstants.DATE_FORMAT) {
    return moment.utc(value).add(1, 'M').format(format)
}

function isLater(dateString1: Date, dateString2: Date) {
    return dateString2 > dateString2
}

function formattedErrors(err: any) {
    let transformed: any = {};
    Object.keys(err).forEach(function (key, val) {
        transformed[key] = err[key][0];
    })
    return transformed
}

export const fileStorage = multer.diskStorage({
    destination: (request: Request, file: Express.Multer.File, callback: DestinationCallback): void => {
        callback(null, './src/uploads/images')
    },

    filename: (req: Request, file: Express.Multer.File, callback: FileNameCallback): void => {
        callback(null, md5(file.originalname) + '-' + Date.now() + path.extname(file.originalname))
    }
})

export const fileStoragePdf = multer.diskStorage({
    destination: (request: Request, file: Express.Multer.File, callback: DestinationCallback): void => {
        // callback(null, './src/uploads/sampleFile')
        callback(null, './src/uploads/files')
    },

    filename: (req: Request, file: Express.Multer.File, callback: FileNameCallback): void => {
        callback(null, md5(file.originalname) + '-' + Date.now() + path.extname(file.originalname))
    }
})

export const fileFilterPdf = (request: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
    console.log("FILE_TYPE: ", file.mimetype)
    if (
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/svg+xml' ||
        file.mimetype === 'audio/mpeg' ||
        file.mimetype === 'audio/mp3' ||
        file.mimetype === 'audio/mp4' ||
        file.mimetype === 'audio/wav' ||
        file.mimetype === 'video/mpg' ||
        file.mimetype === 'video/mp4' ||
        file.mimetype === 'video/m4v' ||
        file.mimetype === 'video/mkv' ||
        file.mimetype === 'video/webm' ||
        file.mimetype === 'video/avi' ||
        file.mimetype === "application/octet-stream" ||
        file.mimetype === "application/pdf" ||
        file.mimetype === "application/zip" ||
        file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.mimetype === "image/bmp" ||
        file.mimetype === "application/vnd.ms-excel" ||
        file.mimetype === "text/plain" ||
        file.mimetype === "image/gif"
    ) {
        callback(null, true)
    } else {
        callback(null, false)
    }
}

export const fileFilters = (request: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
    if (
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === "application/octet-stream" ||
        file.mimetype === "application/msword" ||
        file.mimetype === "application/zip" ||
        file.mimetype === "application/vnd.ms-excel" ||
        file.mimetype === "text/plain" ||
        file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
        callback(null, true)
    } else {
        callback(null, false)
    }
}

export const fileStorageAudio = multer.diskStorage({
    destination: (request: Request, file: Express.Multer.File, callback: DestinationCallback): void => {
        callback(null, './src/uploads/audio')
    },

    filename: (req: Request, file: Express.Multer.File, callback: FileNameCallback): void => {
        callback(null, md5(file.originalname) + '-' + Date.now() + path.extname(file.originalname))
    }
})

export const fileStorageVideo = multer.diskStorage({
    destination: (request: Request, file: Express.Multer.File, callback: DestinationCallback): void => {
        callback(null, './src/uploads/video')
    },

    filename: (req: Request, file: Express.Multer.File, callback: FileNameCallback): void => {
        callback(null, md5(file.originalname) + '-' + Date.now() + path.extname(file.originalname))
    }
})

export const fileFilter = (request: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
    if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'application/octet-stream'
    ) {
        callback(null, true)
    } else {
        callback(null, false)
    }
}
export const fileFilterAudio = (request: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
    if (
        file.mimetype === 'audio/mpeg' ||
        file.mimetype === 'audio/mp3' ||
        file.mimetype === 'audio/mp4' ||
        file.mimetype === 'audio/wav'
    ) {
        callback(null, true)
    } else {
        callback(null, false)
    }
}

export const fileFilterVideo = (request: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
    if (
        file.mimetype === 'video/mpg' ||
        file.mimetype === 'video/mp4' ||
        file.mimetype === 'video/m4v' ||
        file.mimetype === 'video/mkv' ||
        file.mimetype === 'video/webm' ||
        file.mimetype === 'video/avi'
    ) {
        callback(null, true)
    } else {
        callback(null, false)
    }
}

const uploadImage = (req: Request, res: Response, next: NextFunction) => {
    const upload = multer({
        storage: fileStorage,
        fileFilter: fileFilter
    }).single('image')

    upload(req, res, (err: any) => {
        if (err) {
            return sendError(req, res, err)
        }
        next()
    })
}


let guestRoute: any = []

const routeArray = (array_: any, prefix: any, isAdmin: Boolean = false, component: MicroComponent = 0) => {
    // path: "", method: "post", controller: "",validation: ""(can be array of validation), 
    // isEncrypt: boolean (default true), isPublic: boolean (default false)

    array_.forEach((route: any) => {
        const method = route.method as "get" | "post" | "put" | "delete" | "patch";
        const path = route.path;
        const controller = route.controller;
        const validation = route.validation;
        let middlewares = [];
        const isEncrypt = route.isEncrypt === undefined ? true : route.isEncrypt;
        const isPublic = route.isPublic === undefined ? false : route.isPublic;
        const skipComponentId = route.skipComponentId === undefined ? false : route.skipComponentId;
        const isGuest = route.isGuest === undefined ? false : route.isGuest;
        if (isEncrypt && !isAdmin) {
            middlewares.push(decryptedData.DecryptedData);
        }

        if (!isPublic) {
            middlewares.push(verifyToken.verifyToken);
        }

        if (isGuest) {
            guestRoute.push(path)
        }
        middlewares.push(verifyToken.verifyGuestPath);

        if (isAdmin) {
            middlewares.push(verifyToken.isAdmin);
        }
        
        if (validation) {
            if (Array.isArray(validation)) {
                middlewares.push(...validation);
            } else {
                middlewares.push(validation);
            }
        }
        middlewares.push(controller);
        prefix[method](path, ...middlewares);
    })

    return prefix;
}

function secondsToHms(d: number) {
    d = Number(d);
    let h = Math.floor(d / 3600);
    let m = Math.floor(d % 3600 / 60);
    let s = Math.floor(d % 3600 % 60);

    let hDisplay = h > 0 ? h + (h == 1 ? " hour " : " hours ") : "";
    let mDisplay = m > 0 ? m + (m == 1 ? " minute " : " minutes ") : "";
    let sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return hDisplay + mDisplay + sDisplay;
}

function secondsToDhms(seconds: number) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);

    const dDisplay = d > 0 ? d + (d == 1 ? " day " : " days ") : "";
    const hDisplay = h > 0 ? h + (h == 1 ? " hour " : " hours ") : "";
    const mDisplay = m > 0 ? m + (m == 1 ? " minute " : " minutes ") : "";
    const sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}
const notifyToUser = async (userId: any, data_: any, token: any) => {
    try {

        const options = {
            priority: "high",
            content_available: true,
            timeToLive: 60 * 60 * 24,
        };
        let data = data_;
        data.notification = { ...data.notification, sound: "default", click_action: "FLUTTER_NOTIFICATION_CLICK" }

        const notify = new Notification({
            userId: new mongoose.Types.ObjectId(userId),
            notification: data.notification,
            data: data.data
        })
        if (data.data.senderId) notify.senderId = new mongoose.Types.ObjectId(data.data.senderId);
        if (data.data.businessId) notify.businessId = new mongoose.Types.ObjectId(data.data.businessId);
        await notify.save()

        const badge = await Notification.count({ isRead: false, userId: new mongoose.Types.ObjectId(userId) })

        data.notification = { ...data.notification, badge: badge.toString() }
        if (!token) return

        await firebaseMessaging.sendToDevice(token, data, options).then((value: any) => {
            console.log('Successfully sent message:', value);
        }).catch((error: any) => {
            console.log('Error sending message:', error?.errorInfo);
            throw error
        })
        return true
    } catch (er: any) {
        console.log('notifcation error', er.message);
    }
}


async function sendNotification(data_: any, token: any, userId: any) {

    try {
        if (userId === 'multiple') {
            await Promise.all(token.map(async (i: any) => {
                await notifyToUser(i.userId, data_, i.pushToken)
            }))
        } else {
            await notifyToUser(userId, data_, token)
        }
    } catch (e: any) {
        console.log('Error on create data:', e.message);
    }
}

function decodeGroupMessage(data: any) {
    try {
        if (typeof data === "string") data = JSON.parse(data);
        const {
            type,
            actionUserId,
            actionUserDetail,
            affectedUserId,
            affectedUserDetail,
            message,
        } = data;

        switch (type) {
            case groupEvents.NORMAL_MESSAGE:
                return { message, type };
            case groupEvents.CREATE:
                return {
                    message: `${actionUserDetail} created ${message || "group"}`,
                    type,
                };
            case groupEvents.ADD_MEMBER:
                return {
                    message: `${actionUserDetail} added ${affectedUserDetail} to this conversation`,
                    type,
                };
            case groupEvents.REMOVE_MEMBER:
                return {
                    message: `${actionUserDetail} removed ${affectedUserDetail}`,
                    type,
                };
            case groupEvents.JOIN_MEMBER:
                return {
                    message: `${actionUserDetail} joined ${affectedUserDetail}`,
                    type,
                };
            case groupEvents.LEAVE_GROUP:
                return {
                    message: `${actionUserDetail} left from this conversation`,
                    type,
                };
            case groupEvents.UPDATE_GROUP:
                return {
                    message: `${actionUserDetail} has renamed the conversation to ${message}`,
                    type,
                };
            default:
                return { message, type };
        }
    } catch (er: any) {
        console.log(er.message);
        return { message: data, type: groupEvents.NORMAL_MESSAGE };
    }
}


export default {
    getCurrentUTC,
    sendSuccess,
    sendError,
    formattedErrors,
    getRootDir,
    getHomeDir,
    getPubDir,
    formatDate,
    uploadImage,
    routeArray,
    sendAdminSuccess,
    sendAdminError,
    getNext1MonthDate,
    getNext1MonthDateWithDate,
    getNext3DaysDate,
    secondsToHms,
    secondsToDhms,
    isLater,
    sendNotification,
    decodeGroupMessage,
}