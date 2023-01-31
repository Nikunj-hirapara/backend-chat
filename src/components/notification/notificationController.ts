import { AppStrings } from "../../utils/appStrings";
import { Request, Response } from "express";
import commonUtils from "../../utils/commonUtils";
import mongoose from "mongoose";
const Notification = require("./notificationModel");

const notificationList = async (req: Request, res: Response) => {
    const userId = req.headers.userid as string;
    const isRead = ["true", "false"].includes(req.query.isRead as string) ? (req.query.isRead === "true" ? true : false) : null;
    const type = req.query.type as string; //ignore this type of notification ==> pass with comma seprated

    let lastId = req.query.lastId as string;

    let filter: any = {};
    try {
        if (userId) {
            filter = {
                userId: new mongoose.Types.ObjectId(userId),
            };
        }
        if (isRead !== null) {
            filter = {
                ...filter,
                isRead: isRead,
            };
        }
        if (lastId) {
            filter = {
                ...filter,
                _id: { $lt: new mongoose.Types.ObjectId(lastId) },
            };
        }

        if (type !== "" && typeof type === "string") {
            const typeArray = type?.split(",");
            filter = {
                ...filter,
                "data.type": { $nin: typeArray },
            };
        }
        const count = await Notification.count({ $and: [filter] });

        const pipeline = [
            {
                $match: {
                    $and: [filter],
                },
            },
            {
                $lookup: {
                    from: "userprofiles",
                    localField: "senderId",
                    foreignField: "_id",
                    as: "senderInfo",
                },
            },
            {
                $lookup: {
                    from: "businesses",
                    localField: "businessId",
                    foreignField: "_id",
                    as: "businessInfo",
                },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 15 },
            { $unwind: { path: "$senderInfo", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$businessInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    notificationId: "$_id",
                    userId: "$userId",
                    notification: "$notification",
                    data: "$data",
                    isRead: "$isRead",
                    senderInfo: {
                        $cond: {
                            if: "$senderInfo",
                            then: {
                                name: "$senderInfo.name",
                                userId: "$senderInfo.user_id",
                                image: "$senderInfo.image",
                            },
                            else: {
                                name: "",
                                userId: "",
                                image: "",
                            },
                        },
                    },
                    
                },
            },
        ];

        const notify = await Notification.aggregate(pipeline);
        return commonUtils.sendSuccess(req, res, { data: notify, count });
    } catch (e: any) {
        console.log(e.message);
        return commonUtils.sendError(req, res, { message: AppStrings.SOMETHING_WENT_WRONG });
    }
};

const typeWiseCount = async (req: Request, res: Response) => {
    const userId = req.headers.userid as string;

    let filter: any = { isRead: false };
    try {
        if (userId) {
            filter = {
                ...filter,
                userId: new mongoose.Types.ObjectId(userId),
            };
        }

        const pipeline = [
            {
                $match: {
                    $and: [filter],
                },
            },
            { $group: { _id: "$data.type", count: { $sum: 1 } } },
        ];

        const notify = await Notification.aggregate(pipeline);

        return commonUtils.sendSuccess(req, res, notify);
    } catch (e: any) {
        console.log(e.message);
        return commonUtils.sendError(req, res, { message: AppStrings.SOMETHING_WENT_WRONG });
    }
};

const readNotification = async (req: Request, res: Response) => {
    try {
        const userId = req.headers.userid as string;
        const notificationId = req.params.id;
        const type = req.query.type as string;
        let typeArray;
        if (type !== "" && typeof type === "string") {
            typeArray = type?.split(",");
        }
        let log;
        if (notificationId === "all" && req.query.type) {
            log = await Notification.updateMany(
                { userId: new mongoose.Types.ObjectId(userId), "data.type": { $in: typeArray } },
                { $set: { isRead: true } }
            );
        } else if (notificationId === "all") {
            log = await Notification.updateMany({ userId: new mongoose.Types.ObjectId(userId) }, { $set: { isRead: true } });
        } else {
            log = await Notification.findByIdAndUpdate(notificationId, { $set: { isRead: true } });
        }
        console.log(log, notificationId);
        return commonUtils.sendSuccess(req, res, { message: AppStrings.NOTIFICATION_UPDATED });
    } catch (er: any) {
        console.log(er.message);
        return commonUtils.sendError(req, res, { message: AppStrings.SOMETHING_WENT_WRONG });
    }
};

export default {
    notificationList,
    readNotification,
    typeWiseCount,
};
