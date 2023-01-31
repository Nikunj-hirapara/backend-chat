import { AppStrings } from "../../utils/appStrings";
import { Request, Response } from "express";
import { FriendStatus, ImageType, NotificationType, TrustStatus } from "../../utils/enum";

import commonUtils, { fileFilter, fileFilterPdf, fileStorage, fileStoragePdf } from "../../utils/commonUtils";
import eventEmitter from "../../utils/event";
import { LatLng } from "../../utils/locationUtils/LatLng";
import mongoose from "mongoose";
import { userMap, userMapMobile } from "../../index";

const multer = require("multer");

const User = require('./models/userModel');
const { curly } = require('node-libcurl');

const { getAuth } = require('firebase-admin/auth');

/**
 * ignore for now
 */
const setLocation = async (req: any, res: Response) => {
    const user_id = req.headers.userid;
    const user = await User.findById(user_id).exec();
    const { longitude, latitude } = req.body.location || user.location;

    try {
        const location = {
            type: "Point",
            coordinates: [longitude, latitude],
        }
        await User.updateOne({ _id: user_id }, { $set: { "address.location": location } }, { upsert: true }).exec();

        return commonUtils.sendSuccess(req, res, {});
    } catch (error) {
        return commonUtils.sendError(req, res, { message: AppStrings.SOMETHING_WENT_WRONG });
    }

}


const uploadImage = async (req: Request, res: Response) => {
    const user_id = req.headers.userid;
    const user = await User.findById(user_id);
    if (!user)
        return commonUtils.sendError(req, res, { message: AppStrings.USER_NOT_FOUND }, 409);

    const image_ = multer({
        storage: fileStorage,
        fileFilter: fileFilter,
    }).single("image");

    image_(req, res, async (err: any) => {
        if (err) return commonUtils.sendError(req, res, { message: AppStrings.IMAGE_NOT_UPLOADED }, 409);
        if (!req.file) return commonUtils.sendError(req, res, { message: AppStrings.IMAGE_NOT_FOUND }, 409);
        const image_name = req.file.filename;

        switch (parseInt(req.body.type)) {
            case ImageType.USER_IMAGE:
                user.image.userImage = image_name
                break;
            case ImageType.PROFILE_PIC:
                user.image.profilePic = image_name
                break;
            default:
                return commonUtils.sendError(req, res, { message: AppStrings.INVALID_LIST_TYPE })
        }

        await user.save();

        return commonUtils.sendSuccess(req, res, {
            imageName: image_name,
            message: AppStrings.IMAGE_UPLOADED
        }, 200);
    });
}

async function getProfile(req: any, res: Response) {
    let user_id = req.headers.userid;
    const user = await User.findById(user_id).exec();
    if (!user) return commonUtils.sendError(req, res, { message: AppStrings.USER_NOT_FOUND }, 409);

    let parent
    if (user.document.parentId) {
        parent = await User.findOne({
            _id: new mongoose.Types.ObjectId(user.document.parentId)
        })
    }

    const common_fileds = {
        _id: user._id,
        userName: user.userName,
        email: user.email,
        mobile: user.mobile,
        profilePic: user.image.profilePic,
        userType: user.userType ?? null,
        isProfileComplete: user.isProfileComplete,
        // isProfileComplete: (trust?.star ?? 0) == 5 ? 1 : 0,
        fullName: user.fullName,
        status: user.status,
        optionalMobile: user.optionalMobile,
        address: user.address,
        // tempAddress: user.tempAddress,
        temporaryAddress: user.temporaryAddress ? user.temporaryAddress : null,
        document: user.document,
        bio: user.bio,
        userStatus: user.userStatus,
        reference: user.reference,
        permissions: user.permissions,
        idVerifySelfie: user?.idVerifySelfie,
        trustDetails: user.trustLevel,
        documentUpdateCount: user.documentUpdateCount,
        parent: user.document.parentId ? {
            _id: parent._id.toString(),
            userName: parent.userName,
            fullName: parent.fullName,
            profilePic: parent.image.profilePic,
            name: parent.userName,
            email: parent.email,
            mobile: parent.mobile,
            permissions: parent.permissions,
        } : {},
        selfieUpdateAt: user?.selfieUpdateAt
    };


    return commonUtils.sendSuccess(req, res, { ...common_fileds }, 200);
}

//TODO: set current user friend status with

async function profileCompleted(req: any, res: Response) {
    const user_id = req.headers.userid;
    const user = await User.findById(user_id);

    if (!user) return commonUtils.sendError(req, res, { message: AppStrings.USER_NOT_FOUND }, 409);
    try {
        user.optionalMobile = {
            secondary: req.body.optionalMobile?.secondary || req.body?.secondary || "",
            alternative: req.body.optionalMobile?.alternative || req.body?.alternative || "",
        }

        user.bio = req.body.bio || user.bio;
        user.fullName = req.body.fullName || user.fullName;
        user.userStatus = req.body.userStatus || user.userStatus;
        user.userName = req.body?.userName || user.userName

        if (!user.email && req.body?.email) {
            user.email = req.body.email
        }

        if (!user.mobile && req.body?.mobile) {
            user.mobile = req.body.mobile
        }
        await user.save();

        let users = {
            _id: user._id,
            displayName: user.fullName,
            userName: user.userName,
            email: user.email,
            mobile: user.mobile,
            profilePic: user.image.profilePic ?? null
        }

        eventEmitter.emit("updateChatUser", {
            "userId": user._id,
            "name": user.fullName ?? "",
            "image": user.image?.profilePic ?? "",
        })

        return commonUtils.sendSuccess(req, res, { users });

    } catch (e) {
        console.log(e)
        return commonUtils.sendError(req, res, { message: AppStrings.SOMETHING_WENT_WRONG });
    }
}

async function uploadFile(req: Request, res: Response) {
    const file = multer({
        storage: fileStoragePdf,
        fileFilter: fileFilterPdf,
    }).single("file");

    file(req, res, async (err: any) => {
        if (err) {
            return commonUtils.sendError(req, res, { message: AppStrings.FILE_NOT_UPLOADED }, 409);
        }
        if (!req.file) return commonUtils.sendError(req, res, { message: AppStrings.FILE_NOT_FOUND }, 404);
        const image_name = req.file.filename;
        
        return commonUtils.sendSuccess(req, res, {
            file: image_name
        }, 200);
    });
}


async function submitUserDocumentId(req: any, res: Response) {
    const user_id = req.headers.userid;

    const user = await User.findOne({ _id: user_id }).exec();
    if (!user) return commonUtils.sendError(req, res, { message: AppStrings.USER_NOT_FOUND }, 409);

    let {
        idNumber,
        documentType,
        documentName,
        gender,
        dateOfBirth
    } = req.body

    const duplicate = await User.findOne({ 'document.idNumber': idNumber }).exec()

    if (duplicate && !user._id.equals(duplicate._id)) return commonUtils.sendError(req, res, { message: AppStrings.ID_ALREADY_USED })

    try {
        user.document = {
            idNumber: idNumber,
            image: req.body?.image,
            // idVerifySelfie: req.body?.idVerifySelfie,
            docType: documentType,
            docName: documentName,
            gender: gender,
            dateOfBirth: dateOfBirth
        }

        if (documentType == -2 && user.trustLevel.id == 2) {
            user.trustLevel.id = TrustStatus.PENDING
        }

        user.isMark = 1

        await user.save();
        await User.findByIdAndUpdate(user._id,{$inc:{documentUpdateCount:1}});
        
        // await commonUtils.deleteImage(user.document.image);
        return commonUtils.sendSuccess(req, res, { message: AppStrings.DOCUMENT_SUBMITTED_SUCCESSFULLY }, 200);

    } catch (e: any) {
        console.log(e.message)
        return commonUtils.sendError(req, res, { message: AppStrings.SOMETHING_WENT_WRONG });
    }
}

async function methodAllowance(req: any, res: Response) {
    return commonUtils.sendError(req, res, { message: "Request method now allowed." }, 405);
}

async function searchUser(req: Request, res: Response) {
    let filter = {};
    var filterTextValue: any = req.query.search;

    const skipIds = req.query?.skipIds;
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    const name = /[A-z]/;

    if (filterTextValue) {
        if (emailPattern.test(filterTextValue)) {
            filter = { email: filterTextValue };
        } else if (name.test(filterTextValue)) {
            filter = { fullName: { $regex: filterTextValue, $options: "i" } }
        } else {
            filter = { mobile: `+${filterTextValue.trim()}` }
        }
    } else {
        return commonUtils.sendSuccess(req, res, [])
    }

    if (skipIds !== "" && typeof skipIds === "string") {
        //validate skipId array and check mongoose objectId format
        const skipArray = skipIds
            ?.split(",")
            .filter((item) => mongoose.Types.ObjectId.isValid(item))
            ?.map((item) => new mongoose.Types.ObjectId(item));

        filter = {
            $and: [{ _id: { $nin: skipArray } }, filter],
        };
    }

    let user: any = [];

    if (Object.keys(filter).length !== 0) {
        user = await User.find(filter);
    }

    return commonUtils.sendSuccess(req, res, user);
}

export default {
    getProfile,
    profileCompleted,
    uploadImage,
    setLocation,
    submitUserDocumentId,
    uploadFile,
    searchUser,
    methodAllowance,
}