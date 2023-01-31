import {AppStrings} from "../../utils/appStrings";

import {NextFunction, Request, Response} from "express";
import commonUtils, {
    fileFilter,
    fileFilterAudio,
    fileFilterPdf, fileFilterVideo,
    fileStorage,
    fileStorageAudio,
    fileStoragePdf, fileStorageVideo
} from "../../utils/commonUtils";
import {io, userMap, userMapMobile} from "../../index";
import redisClient from "../../utils/redisHelper";
import {AppConstants} from "../../utils/appConstants";
import multer from "multer";
import moment from "moment/moment";
import mongoose from "mongoose";

const Block = require('./models/blockUsers');
const UserProfile = require('./models/userProfile');
const Group = require('./models/groupModel');
const Conversation = require('./models/conversationModel');
const Chat = require('./models/chatModel');
const User = require('../../components/users/models/userModel');
import {convType, groupEvents, MessageStatusEnum, MsgType, NotificationType} from "../../utils/enum";
import {randomUUID} from "crypto";
import admin from "../admin";

var _ = require('lodash');


const ffmpeg = require('fluent-ffmpeg');

const blockedUsers = async (req: Request, res: Response) => {
    let user_id = req.headers.userid;
    try {
        let blocked = await Block.find({user_id: user_id, deleted: 0}).populate("blocked_id", "name image").lean().exec();

        let blockedEntry = blocked.map((doc: any) => {
            return {
                name: doc.blocked_id.name,
                image: doc.blocked_id.image,
                _id: doc.blocked_id._id,
                createdAt: doc.createdAt,
            };
        });


        return commonUtils.sendSuccess(req, res, blockedEntry);
    } catch (error) {
        return commonUtils.sendError(req, res, {message: AppStrings.SOMETHING_WENT_WRONG});
    }
};

const blockUnblockUser = async (req: Request, res: Response) => {
    let user_id = req.headers.userid
    let {receiverId, status} = req.body

    const blockedEntry = await Block.findOne({user_id: user_id, blocked_id: receiverId, deleted: 0}).lean().exec();

    if (status === 1) {
        if (blockedEntry) {
            return commonUtils.sendError(req, res, {message: AppStrings.ALREADY_BLOCKED}, 409)
        }

        let block = new Block()
        block.user_id = user_id
        block.blocked_id = receiverId
        await block.save()


        userMap[receiverId?.toString()]?.forEach((value: any) => io.sockets.sockets.get(value)?.emit("blockUnblock", {
            "from": user_id,
            "to": receiverId,
            "status": status
        }))

        userMap[receiverId?.toString()]?.forEach((value: any) => io.sockets.sockets.get(value)?.leave("OUT_" + user_id.toString()))
        userMap[user_id.toString()]?.forEach((value: any) => io.sockets.sockets.get(value)?.leave("OUT_" + receiverId))


        if (userMapMobile[receiverId?.toString()]) {
            io.sockets.sockets.get(userMapMobile[receiverId?.toString()])?.emit("blockUnblock", {
                "from": user_id,
                "to": receiverId,
                "status": status
            })

            io.sockets.sockets.get(userMapMobile[receiverId?.toString()])?.leave("OUT_" + user_id.toString())
            io.sockets.sockets.get(userMapMobile[user_id.toString()])?.leave("OUT_" + receiverId)


        } else {
            // SAVE SYNC INFO : BLOCK
            await redisClient.lpush(receiverId, JSON.stringify({
                ...{
                    "from": user_id,
                    "to": receiverId,
                    "status": status
                },
                ...{
                    "syncType": AppConstants.SYNC_TYPE_BLOCK_UNBLOCK
                }
            }));
        }


        return commonUtils.sendSuccess(req, res, {message: AppStrings.BLOCK_SUCCESS}, 201)
    } else {
        if (!blockedEntry) {
            return commonUtils.sendError(req, res, {message: AppStrings.INVALID_REQUEST}, 409)
        }

        await Block.updateOne({user_id: user_id, blocked_id: receiverId, deleted: 0}, {
            $set: {
                deleted: 1
            }
        })
        userMap[receiverId?.toString()]?.forEach((value: any) => io.sockets.sockets.get(value)?.emit("blockUnblock", {
            "from": user_id,
            "to": receiverId,
            "status": status
        }))

        userMap[receiverId?.toString()]?.forEach((value: any) => io.sockets.sockets.get(value)?.join("OUT_" + user_id.toString()))
        userMap[user_id.toString()]?.forEach((value: any) => io.sockets.sockets.get(value)?.join("OUT_" + receiverId))


        let blockedExists = await Block.findOne({
            $or: [
                {
                    $and: [
                        {user_id: user_id.toString()},
                        {blocked_id: receiverId},
                        {deleted: 0}
                    ]
                }, {
                    $and: [
                        {blocked_id: user_id.toString()},
                        {user_id: receiverId},
                        {deleted: 0}
                    ]
                }
            ]
        }).select("_id")
        if (!blockedExists) {
            io.sockets.sockets.get(userMapMobile[receiverId?.toString()])?.join("OUT_" + user_id.toString())
            io.sockets.sockets.get(userMapMobile[user_id.toString()])?.join("OUT_" + receiverId)
        }


        if (userMapMobile[receiverId?.toString()]) {
            io.sockets.sockets.get(userMapMobile[receiverId?.toString()])?.emit("blockUnblock", {
                "from": user_id,
                "to": receiverId,
                "status": status
            })
        } else {
            // SAVE SYNC INFO : UNBLOCK
            await redisClient.lpush(receiverId, JSON.stringify({
                ...{
                    "from": user_id,
                    "to": receiverId,
                    "status": status
                },
                ...{
                    "syncType": AppConstants.SYNC_TYPE_BLOCK_UNBLOCK
                }
            }));
        }

        return commonUtils.sendSuccess(req, res, {message: AppStrings.UNBLOCKED_SUCCESS}, 201)

    }


}

const registerChatUser = async (data: any) => {
    {
        // TODO : Add ChatUser entry

        let {userId, name, image} = data

        let userProfile = new UserProfile()
        userProfile._id = userId
        userProfile.user_id = userId
        userProfile.name = name ?? ""
        userProfile.image = image ?? ""
        await userProfile.save()
    }
}
const updateChatUser = async (data: any) => {
    {
        // TODO : Update ChatUser entry

        let {userId, name, image} = data
        let userProfile = await UserProfile.findOne({_id: userId})

        if (userProfile) {
            if (name) userProfile.name = name
            if (image) userProfile.image = image ?? ""
            await userProfile.save()
        } else {
            await UserProfile.create({
                _id: userId,
                user_id: userId,
                name: name ?? "",
                image: image ?? ""
            })
        }
        let userPro = await UserProfile.findOne({_id: userId}).lean()
        io.in(`OUT_${userId}`)?.emit("updateProfile", {...userPro, id: userId})
    }
}


const uploadImage = async (req: Request, res: Response, next: NextFunction) => {

    const image_ = multer({
        storage: fileStorage,
        fileFilter: fileFilter,
    }).single("image");

    image_(req, res, async (err: any) => {
        if (err) return commonUtils.sendError(req, res, {message: AppStrings.IMAGE_NOT_UPLOADED}, 409);
        if (!req.file) return commonUtils.sendError(req, res, {message: AppStrings.FILE_FORMAT_NOT_SUPPORTED}, 409);
        const image_name = req.file.filename;

        return commonUtils.sendSuccess(req, res, {
            image: image_name
        });
    });
}

const sendGroupNotification = async (offlineUser: any, userid: any, title: any, messageData: any) => {

    if (offlineUser?.length) {
        try {
            const sender = await User.findById(userid);
            await commonUtils.sendNotification({
                notification: {
                    title: AppStrings.GROUP_MESSAGE.TITLE.replace(':name', sender?.fullName ?? 'user').replace(':group', title ?? 'group'),
                    body: AppStrings.GROUP_MESSAGE.BODY.replace(':message', commonUtils.decodeGroupMessage(messageData.message)?.message)
                },
                data: {
                    stringify: JSON.stringify({...messageData}),
                    senderId: userid.toString(),
                    type: NotificationType.GROUP_MESSAGE.toString()
                }
            }, offlineUser, 'multiple')
        } catch (e: any) {
            console.log('chat group message event error', e.messsage);
        }
    }
}

const createGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        
        let userid = req.headers.userid

        let {
            title,
            description,
            image,
            members,
            isPrivate,
            geoTag
        } = req.body

        let groupMembers = members.trim().split(",")

        let blockedByCreator = await Block.find({
            user_id: userid,
            deleted: 0
        }).select("blocked_id")

        let blockedByMembers = await Block.find({
            blocked_id: userid,
            deleted: 0
        }).select("user_id")

        let blocked = blockedByCreator.map((value: any) => value.blocked_id)
        let blockedMem = blockedByMembers.map((value: any) => value.user_id)
        groupMembers = groupMembers.filter((value: any) => !blocked.includes(value))
        groupMembers = groupMembers.filter((value: any) => !blockedMem.includes(value))

        const {name} = await UserProfile.findOne({user_id: userid})

        let groupChatId = new mongoose.Types.ObjectId()

        let group = new Group()
        group.name = title
        group.description = description
        group.image = image
        group.private = isPrivate
        group.userId = userid
        group.userName = name
        group.members = groupMembers
        group.admins = [userid]
        group.chatId = groupChatId
        group.geoTag = geoTag
        await group.save()

        const convAdmin: any = {
            senderId: userid,
            chatId: groupChatId,
            groupId: group._id,
            clearedAt: moment().valueOf(),
            pin: false,
            mute: false,
            deleted: false,
            active: true,
            type: convType.GROUP
        }
        await Conversation.create(convAdmin)

        io.sockets.sockets.get(userMapMobile[userid.toString()] ?? "")?.join(groupChatId.toString())        
        userMap[userid.toString()]?.map((w:any)=>{
            io.sockets.sockets.get(w)?.join(groupChatId.toString())    
        })

        await Promise.all(groupMembers.map(async (id: any) => {
            const convMember: any = {
                senderId: id,
                chatId: groupChatId,
                groupId: group._id,
                clearedAt: moment().valueOf(),
                pin: false,
                mute: false,
                deleted: false,
                active: true,
                type: convType.GROUP
            }
            await Conversation.create(convMember)

            io.sockets.sockets.get(userMapMobile[id.toString()] ?? "")?.join(groupChatId.toString())
            userMap[id.toString()]?.forEach((data: any) => {
                io.sockets.sockets.get(data)?.join(groupChatId.toString())
            })
        }))


        let adminUserDetails = await UserProfile.findOne({
            _id: userid
        })

        let groupEventData: any = {}
        groupEventData.type = groupEvents.CREATE
        groupEventData.actionUserId = userid
        groupEventData.actionUserDetail = adminUserDetails?.name
        groupEventData.message = title
        groupEventData.affectedUserId = ""
        groupEventData.affectedUserDetail = ""


        let messageData: any = {
            mId: randomUUID(),
            message: JSON.stringify(groupEventData),
            msgType: MsgType.EVENT,
            readStatus: MessageStatusEnum.SENT,
            convType: convType.GROUP,
            deletedStatus: 0,
            geoTag: geoTag,
            senderId: userid,
            receiverId: group._id,
            chatId: groupChatId,
            groupId: group._id,
        }

        await Chat.create(messageData)

        messageData.createdDate = Date.now()
        messageData.updatedDate = Date.now()

        let offlineUser: any = []


        await Promise.all(groupMembers.map(async (value: any) => {
            let receiverSockId = userMapMobile[value.toString()]

            if (receiverSockId) {
                io.sockets.sockets.get(receiverSockId)?.emit("groupMessage", messageData)
            } else {
                if (userid.toString() !== value.toString()) {
                    const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                    offlineUser.push({
                        pushToken,
                        userId: value.toString()
                    })
                }

                // SAVE SYNC INFO : MESSAGE
                await redisClient.lpush(value, JSON.stringify({
                    ...messageData,
                    ...{
                        "syncType": AppConstants.SYNC_TYPE_MESSAGE
                    }
                }));
            }

            const webChat = userMap[value.toString()]
            if (!_.isEmpty(webChat)) {
                webChat?.map((e: any) => {
                    if (e) {
                        io.sockets.sockets.get(e)?.emit("groupMessage", messageData)
                    }
                })
            }
            
        }))
        await sendGroupNotification(offlineUser, userid, title, messageData)

        return commonUtils.sendSuccess(req, res, {message: AppStrings.GROUP_CREATE_SUCCESS, groupId: group._id}, 201)
    } catch (er:any) {
        console.log(er.message);
        return commonUtils.sendError(req, res, {message: AppStrings.SOMETHING_WENT_WRONG})        
    }
}

const updateGroup = async (req: Request, res: Response, next: NextFunction) => {

    let userid = req.headers.userid
    const groupId = req.params.groupid

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
        const GroupData = await Group.findById(groupId)
        if (!GroupData) return commonUtils.sendError(req, res, {message: AppStrings.GROUP_NOT_FOUND})
    } else {
        return commonUtils.sendError(req, res, {message: AppStrings.INVALID_ID})
    }

    let {
        title,
        description,
        image,
        geoTag,
        isPrivate
    } = req.body

    const GroupData = await Group.findById(groupId)
    const oldName = GroupData.name

    GroupData.name = title ?? GroupData.name
    GroupData.description = description ?? GroupData.description
    GroupData.image = image ?? GroupData.image
    GroupData.private = isPrivate
    if (geoTag)
        GroupData.geoTag = geoTag
    await GroupData.save()
    
    const {name} = await UserProfile.findOne({user_id: userid})
    const {chatId} = await Conversation.findOne({groupId: groupId})

    if (title || description || image || geoTag?.name || isPrivate) {
        let groupEventData: any = {}
        groupEventData.type = groupEvents.UPDATE_GROUP
        groupEventData.actionUserId = userid
        groupEventData.actionUserDetail = name
        groupEventData.message = JSON.stringify({
            "title": GroupData.name,
            "description": GroupData.description,
            "image": GroupData.image,
            "geoTag": GroupData.geoTag,
            "isPrivate": GroupData.isPrivate,
        })
        groupEventData.affectedUserId = ""
        groupEventData.affectedUserDetail = oldName

        const messageData: any = {
            mId: randomUUID(),
            message: JSON.stringify(groupEventData),
            msgType: MsgType.EVENT,
            readStatus: MessageStatusEnum.SENT,
            convType: convType.GROUP,
            deletedStatus: 0,
            groupId: GroupData._id,
            geoTag: null,
            senderId: userid,
            receiverId: GroupData._id,
            chatId: chatId,
        }

        await Chat.create(messageData)

        messageData.createdDate = Date.now()
        messageData.updatedDate = Date.now()

        let offlineUser: any = []

        await Promise.all(GroupData.members.concat(GroupData.admins).map(async (value: any) => {
            let receiverSockId = userMapMobile[value.toString()]

            if (receiverSockId) {
                io.sockets.sockets.get(receiverSockId)?.emit("groupMessage", messageData)
            } else {
                if (userid.toString() !== value.toString()) {
                    const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                    offlineUser.push({
                        pushToken,
                        userId: value.toString()
                    })
                }
                // TODO
                // SAVE SYNC INFO : MESSAGE
                await redisClient.lpush(value, JSON.stringify({
                    ...messageData,
                    ...{
                        "syncType": AppConstants.SYNC_TYPE_MESSAGE
                    }
                }));
            }

            const webChat = userMap[value.toString()]
            if (!_.isEmpty(webChat)) {
                webChat?.map((e: any) => {
                    if (e) {
                        io.sockets.sockets.get(e)?.emit("groupMessage", messageData)
                    }
                })
            }

        }))
        await sendGroupNotification(offlineUser, userid, GroupData.title, messageData)

    }

    return commonUtils.sendSuccess(req, res, {message: AppStrings.GROUP_UPDATE_SUCCESS, groupId: groupId})
}


async function uploadAudio(req: any, res: Response) {
    const audio = multer({
        storage: fileStorageAudio,
        fileFilter: fileFilterAudio,
    }).single("audio");

    audio(req, res, async (err: any) => {
        if (err) {
            return commonUtils.sendError(req, res, {message: AppStrings.AUDIO_NOT_UPLOADED}, 409);
        }
        if (!req.file) return commonUtils.sendError(req, res, {message: AppStrings.FILE_FORMAT_NOT_SUPPORTED}, 409);
        const image_name = req.file.filename;
        return commonUtils.sendSuccess(req, res, {
            audio: image_name
        }, 200);
    });
}

async function uploadVideo(req: any, res: Response) {
    try {

        const video = multer({
            storage: fileStorageVideo,
            fileFilter: fileFilterVideo,
        }).single("video");

        video(req, res, async (err: any) => {
            if (err) {
                return commonUtils.sendError(req, res, {message: AppStrings.VIDEO_NOT_UPLOADED}, 409);
            }
            if (!req.file) return commonUtils.sendError(req, res, {message: AppStrings.FILE_FORMAT_NOT_SUPPORTED}, 409);

            ffmpeg('./src/uploads/video/' + req.file.filename)
                .on('filenames', function (filenames: any) {
                    console.log('Will generate ' + filenames.join(', '))
                }).on('error', function (err: any, stdout: any, stderr: any) {
                console.error(err);
                console.error(stderr);
                return res.status(422).json({
                    'message': "oops ,Something Went Wrong !!",
                });
            }).on('end', function () {
                const responseData = {
                    "video": req.file.filename,
                    "thumbnail": 'thumb/' + req.file.filename.substring(0, req.file.filename.indexOf(".")) + ".jpg"
                }
                return commonUtils.sendSuccess(req, res, responseData);
            }).screenshots({
                filename: req.file.filename.substring(0, req.file.filename.indexOf(".")) + ".jpg",
                count: 1,
                folder: './src/uploads/video/thumb/',
                size: '320x240'
            });

        });
    } catch (error) {
        return commonUtils.sendError(req, res, {message: AppStrings.SOMETHING_WENT_WRONG});
    }
}

async function uploadFile(req: Request, res: Response) {
    const file = multer({
        storage: fileStoragePdf,
        fileFilter: fileFilterPdf,
    }).single("file");

    file(req, res, async (err: any) => {
        if (err) {
            console.log(err)
            return commonUtils.sendError(req, res, {message: AppStrings.FILE_NOT_UPLOADED}, 409);
        }
        if (!req.file) {
            return commonUtils.sendError(req, res, {message: AppStrings.FILE_FORMAT_NOT_SUPPORTED}, 409);
        }
        const image_name = req.file.filename;
        return commonUtils.sendSuccess(req, res, {
            file: image_name
        }, 200);
    });
}

async function groupMembers(req: Request, res: Response) {

    let groupId = req.params.groupid

    let pipeline = [{
        $match: {
            _id: new mongoose.Types.ObjectId(groupId)
        },
    }, {
        $lookup:
            {
                from: "userprofiles",
                localField: "members",
                foreignField: "_id",
                as: "members_info"
            }
    }, {
        $lookup:
            {
                from: "userprofiles",
                localField: "admins",
                foreignField: "_id",
                as: "admins_info"
            }
    }, {
        $project: {
            members: "$members_info",
            admins: "$admins_info"
        }
    }]

    let info = await Group.aggregate(pipeline)
    let groupInfo = info.length > 0 ? info[0] : {}
    return commonUtils.sendSuccess(req, res, groupInfo)

}

async function addMember(req: Request, res: Response) {

    let adminid = req.headers.userid

    let {
        groupid: groupId,
        userid: userId
    } = req.params

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user_ = await User.findOne({
            _id: userId,
        })
        if (!user_) return commonUtils.sendError(req, res, {message: AppStrings.USER_NOT_FOUND})
    }

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
        const group = await Group.findOne({
            _id: groupId
        })
        if (!group) return commonUtils.sendError(req, res, {message: AppStrings.GROUP_NOT_FOUND})

        if (group.private && !group.admins.includes(adminid)) {
            return commonUtils.sendError(req, res, {message: AppStrings.ADMIN_ERROR})
        }


        let blockedByCreator = await Block.find({
            user_id: adminid,
            deleted: 0
        }).select("blocked_id")

        let blockedByMembers = await Block.find({
            blocked_id: userId,
            deleted: 0
        }).select("user_id")

        let blocked = blockedByCreator.map((value: any) => value.blocked_id)
        let blockedMem = blockedByMembers.map((value: any) => value.user_id)
        if (!blockedMem.includes(userId) && !blocked.includes(userId)) {

            if (group.members.includes(userId) || group.admins.includes(userId)) {
                return commonUtils.sendError(req, res, {message: AppStrings.ALREADY_A_MEMBER})
            }

            const convMember: any = {
                senderId: userId,
                chatId: group.chatId,
                groupId: group._id,
                clearedAt: moment().valueOf(),
                pin: false,
                mute: false,
                deleted: false,
                active: true,
                type: convType.GROUP
            }
            await Conversation.create(convMember)

            io.sockets.sockets.get(userMapMobile[userId.toString()] ?? "")?.join(group.chatId?.toString())
            userMap[userId.toString()]?.forEach((data: any) => {
                io.sockets.sockets.get(data)?.join(group.chatId?.toString())
            })

            group.members.push(userId)
            await group.save()

            let adminUserDetails = await UserProfile.findOne({
                _id: adminid
            })

            const {name: userName} = await UserProfile.findById(userId)

            let groupEventData: any = {}
            groupEventData.type = groupEvents.ADD_MEMBER
            groupEventData.actionUserId = adminid
            groupEventData.actionUserDetail = adminUserDetails?.name
            groupEventData.affectedUserId = userId
            groupEventData.affectedUserDetail = userName


            const messageData: any = {
                mId: randomUUID(),
                message: JSON.stringify(groupEventData),
                msgType: MsgType.EVENT,
                readStatus: MessageStatusEnum.SENT,
                groupId: group._id,
                convType: convType.GROUP,
                deletedStatus: 0,
                senderId: adminid,
                receiverId: group._id,
                chatId: group.chatId,
            }

            await Chat.create(messageData)
            messageData.createdDate = Date.now()
            messageData.updatedDate = Date.now()

            let offlineUser: any = []
            await Promise.all(group.members.concat(group.admins).map(async (value: any) => {
                let receiverSockId = userMapMobile[value.toString()]

                if (receiverSockId) {
                    io.sockets.sockets.get(receiverSockId)?.emit("groupMessage", messageData)
                } else {
                    if (adminid.toString() !== value.toString()) {
                        const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                        offlineUser.push({
                            pushToken,
                            userId: value.toString()
                        })
                    }

                    // TODO
                    // SAVE SYNC INFO : MESSAGE
                    await redisClient.lpush(value, JSON.stringify({
                        ...messageData,
                        ...{
                            "syncType": AppConstants.SYNC_TYPE_MESSAGE
                        }
                    }));
                }

                const webChat = userMap[value.toString()]
                if (!_.isEmpty(webChat)) {
                    webChat?.map((e: any) => {
                        if (e) {
                            io.sockets.sockets.get(e)?.emit("groupMessage", messageData)
                        }
                    })
                }
            }))
            await sendGroupNotification(offlineUser, adminid, group.name, messageData)

            return commonUtils.sendSuccess(req, res, AppStrings.MEMBER_ADDED)

        } else {
            // TODO : user block message
        }
    }
    return commonUtils.sendError(req, res, {message: AppStrings.PARAMS_IS_REQUIRED})

}

async function removeMember(req: Request, res: Response) {
    let adminid = req.headers.userid

    let {
        groupid: groupId,
        userid: userId
    } = req.params

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user_ = await User.findOne({
            _id: userId,
        })
        if (!user_) return commonUtils.sendError(req, res, {message: AppStrings.USER_NOT_FOUND})
    }

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
        const group = await Group.findOne({
            _id: groupId
        })
        if (!group) return commonUtils.sendError(req, res, {message: AppStrings.GROUP_NOT_FOUND})

        if (!group.admins.includes(adminid)) {
            return commonUtils.sendError(req, res, {message: AppStrings.ADMIN_ERROR})
        }


        let blockedByCreator = await Block.find({
            user_id: adminid,
            deleted: 0
        }).select("blocked_id")

        let blockedByMembers = await Block.find({
            blocked_id: userId,
            deleted: 0
        }).select("user_id")

        let blocked = blockedByCreator.map((value: any) => value.blocked_id)
        let blockedMem = blockedByMembers.map((value: any) => value.user_id)
        if (!blockedMem.includes(userId) && !blocked.includes(userId)) {


            const index = group.members.indexOf(userId);

            if (index !== -1) {
                group.members.splice(index, 1);
            }

            const indexAdmin = group.admins.indexOf(userId);

            if (indexAdmin !== -1) {
                group.admins.splice(indexAdmin, 1);
            }

            if (index === -1 && indexAdmin === -1) {
                return commonUtils.sendError(req, res, {message: AppStrings.MEMBER_NOT_FOUND})
            }

            await Conversation.deleteOne({
                senderId: userId,
                // chatId: group.chatId,
                groupId: group._id,
            })
            await group.save()

            let adminUserDetails = await UserProfile.findOne({
                _id: adminid
            })
            const {name: userName} = await UserProfile.findById(userId)

            let groupEventData: any = {}
            groupEventData.type = groupEvents.REMOVE_MEMBER
            groupEventData.actionUserId = adminid
            groupEventData.actionUserDetail = adminUserDetails?.name
            groupEventData.affectedUserId = userId
            groupEventData.affectedUserDetail = userName


            const messageData: any = {
                mId: randomUUID(),
                message: JSON.stringify(groupEventData),
                msgType: MsgType.EVENT,
                readStatus: MessageStatusEnum.SENT,
                convType: convType.GROUP,
                deletedStatus: 0,
                senderId: adminid,
                receiverId: group._id,
                chatId: group.chatId,
                groupId: group._id,
            }

            await Chat.create(messageData)
            messageData.createdDate = Date.now()
            messageData.updatedDate = Date.now()

            let offlineUser: any = []


            await Promise.all(group.members.concat(group.admins).concat([userId]).map(async (value: any) => {
                let receiverSockId = userMapMobile[value.toString()]

                if (receiverSockId) {

                    io.sockets.sockets.get(receiverSockId)?.emit("groupMessage", messageData)
                } else {
                    if (adminid.toString() !== value.toString()) {
                        const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                        offlineUser.push({
                            pushToken,
                            userId: value.toString()
                        })
                    }


                    // SAVE SYNC INFO : MESSAGE
                    await redisClient.lpush(value, JSON.stringify({
                        ...messageData,
                        ...{
                            "syncType": AppConstants.SYNC_TYPE_MESSAGE
                        }
                    }));
                }

                const webChat = userMap[value.toString()]
                if (!_.isEmpty(webChat)) {
                    webChat?.map((e: any) => {
                        if (e) {
                            io.sockets.sockets.get(e)?.emit("groupMessage", messageData)
                        }
                    })
                }
            }))
            io.sockets.sockets.get(userMapMobile[userId.toString()] ?? "")?.leave(group.chatId?.toString())

            userMap[userId.toString()]?.forEach((data: any) => {
                io.sockets.sockets.get(data)?.leave(group.chatId?.toString())
            })

            io.sockets.sockets.get(userMapMobile[userId.toString()])?.emit("groupMessage", messageData)

            await sendGroupNotification(offlineUser, adminid, group.name, messageData)

            return commonUtils.sendSuccess(req, res, {message: AppStrings.MEMBER_REMOVED})

        } else {
            // TODO : user block message
        }
    }
    return commonUtils.sendError(req, res, {message: AppStrings.PARAMS_IS_REQUIRED})
}

async function deleteGroup(req: Request, res: Response) {
    let adminid = req.headers.userid

    let {groupid: groupId} = req.params

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
        const group = await Group.findOne({_id: groupId})
        if (!group) return commonUtils.sendError(req, res, {message: AppStrings.GROUP_NOT_FOUND})

        if (!group.admins.includes(adminid)) {
            return commonUtils.sendError(req, res, {message: AppStrings.ADMIN_ERROR})
        }

        let blockedByCreator = await Block.find({
            user_id: adminid,
            deleted: 0
        }).select("blocked_id")

        let blocked = blockedByCreator.map((value: any) => value.blocked_id)        
        const index = group.members.indexOf(adminid);

        if (index !== -1) {
            group.members.splice(index, 1);
        }

        const indexAdmin = group.admins.indexOf(adminid);

        if (indexAdmin !== -1) {
            group.admins.splice(indexAdmin, 1);
        }

        if (index === -1 && indexAdmin === -1) {
            return commonUtils.sendError(req, res, {message: AppStrings.MEMBER_NOT_FOUND})
        }

        await Conversation.deleteOne({
            senderId: adminid,
            groupId: group._id,
            deleted:true
        })
        await group.save()

        let adminUserDetails = await UserProfile.findOne({
            _id: adminid
        })
        const {name: userName} = await UserProfile.findById(adminid)

        let groupEventData: any = {}
        groupEventData.type = groupEvents.DELETE_GROUP
        groupEventData.actionUserId = adminid
        groupEventData.actionUserDetail = adminUserDetails?.name
        groupEventData.affectedUserId = adminid
        groupEventData.affectedUserDetail = userName

        const messageData: any = {
            mId: randomUUID(),
            message: JSON.stringify(groupEventData),
            msgType: MsgType.EVENT,
            readStatus: MessageStatusEnum.SENT,
            convType: convType.GROUP,
            deletedStatus: 0,
            senderId: adminid,
            receiverId: group._id,
            chatId: group.chatId,
            groupId: group._id,
        }

        await Chat.create(messageData)
        messageData.createdDate = Date.now()
        messageData.updatedDate = Date.now()

        let offlineUser: any = []


        await Promise.all(group.members.concat(group.admins).concat([adminid]).map(async (value: any) => {
            let receiverSockId = userMapMobile[value.toString()]

            if (receiverSockId) {

                io.sockets.sockets.get(receiverSockId)?.emit("groupMessage", messageData)
            } else {
                if (adminid.toString() !== value.toString()) {
                    const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                    offlineUser.push({
                        pushToken,
                        userId: value.toString()
                    })
                }


                // SAVE SYNC INFO : MESSAGE
                await redisClient.lpush(value, JSON.stringify({
                    ...messageData,
                    ...{
                        "syncType": AppConstants.SYNC_TYPE_MESSAGE
                    }
                }));
            }

            const webChat = userMap[value.toString()]
            if (!_.isEmpty(webChat)) {
                webChat?.map((e: any) => {
                    if (e) {
                        io.sockets.sockets.get(e)?.emit("groupMessage", messageData)
                    }
                })
            }
        }))
        io.sockets.sockets.get(userMapMobile[adminid.toString()] ?? "")?.leave(group.chatId?.toString())


        userMap[adminid.toString()]?.forEach((data: any) => {
            io.sockets.sockets.get(data)?.leave(group.chatId?.toString())
        })

        io.sockets.sockets.get(userMapMobile[adminid.toString()])?.emit("groupMessage", messageData)

        await sendGroupNotification(offlineUser, adminid, group.name, messageData)

        //actual delete process
        await Conversation.deleteMany({groupId: group._id})
        await Group.deleteOne({_id: groupId})
        //end

        return commonUtils.sendSuccess(req, res, {message: AppStrings.MEMBER_REMOVED})
        
    }
    return commonUtils.sendError(req, res, {message: AppStrings.PARAMS_IS_REQUIRED})
}

async function leaveGroup(req: Request, res: Response) {
    let userId = req.headers.userid as string

    let {groupid: groupId} = req.params

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user_ = await User.findOne({
            _id: userId,
        })
        if (!user_) return commonUtils.sendError(req, res, {message: AppStrings.USER_NOT_FOUND})
    }

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
        const group = await Group.findOne({_id: groupId})
        if (!group) return commonUtils.sendError(req, res, {message: AppStrings.GROUP_NOT_FOUND})

        const index = group.members.indexOf(userId);

        if (index !== -1) {
            group.members.splice(index, 1);
        }

        const indexAdmin = group.admins.indexOf(userId);

        if (indexAdmin !== -1) {
            group.admins.splice(indexAdmin, 1);
        }

        if (index === -1 && indexAdmin === -1) {
            return commonUtils.sendError(req, res, {message: AppStrings.MEMBER_NOT_FOUND})
        }

        await Conversation.deleteOne({
            senderId: userId,
            // chatId: group.chatId,
            groupId: group._id,
        })
        await group.save()

        const {name: userName} = await UserProfile.findById(userId)

        let groupEventData: any = {}
        groupEventData.type = groupEvents.LEAVE_GROUP
        groupEventData.actionUserId = userId
        groupEventData.actionUserDetail = userName
        groupEventData.affectedUserId = ""
        groupEventData.affectedUserDetail = ""

        const messageData: any = {
            mId: randomUUID(),
            message: JSON.stringify(groupEventData),
            msgType: MsgType.EVENT,
            readStatus: MessageStatusEnum.SENT,
            convType: convType.GROUP,
            deletedStatus: 0,
            senderId: userId,
            receiverId: group._id,
            groupId: group._id,
            chatId: group.chatId,
        }

        await Chat.create(messageData)
        messageData.createdDate = Date.now()
        messageData.updatedDate = Date.now()

        let offlineUser: any = []
        await Promise.all(group.members.concat(group.admins).map(async (value: any) => {
            let receiverSockId = userMapMobile[value.toString()]

            if (receiverSockId) {
                io.sockets.sockets.get(receiverSockId)?.emit("groupMessage", messageData)
            } else {
                if (userId.toString() !== value.toString()) {
                    const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                    offlineUser.push({
                        pushToken,
                        userId: value.toString()
                    })
                }

                // TODO
                // SAVE SYNC INFO : MESSAGE
                await redisClient.lpush(value, JSON.stringify({
                    ...messageData,
                    ...{
                        "syncType": AppConstants.SYNC_TYPE_MESSAGE
                    }
                }));
            }
            const webChat = userMap[value.toString()]
            if (!_.isEmpty(webChat)) {
                webChat?.map((e: any) => {
                    if (e) {
                        io.sockets.sockets.get(e)?.emit("groupMessage", messageData)
                    }
                })
            }
        }))
        io.sockets.sockets.get(userMapMobile[userId.toString()] ?? "")?.leave(group?.chatId?.toString())
        userMap[userId.toString()]?.forEach((data: any) => {
            io.sockets.sockets.get(data)?.leave(group?.chatId?.toString())
        })
        await sendGroupNotification(offlineUser, userId, group.name, messageData)

        return commonUtils.sendSuccess(req, res, {message: AppStrings.MEMBER_LEAVE})
    }
    return commonUtils.sendError(req, res, {message: AppStrings.PARAMS_IS_REQUIRED})
}

async function addGroupAdmin(req: Request, res: Response) {

    let adminid = req.headers.userid

    let {
        groupid: groupId,
        userid: userId
    } = req.params

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user_ = await User.findOne({
            _id: userId,
        })
        if (!user_) return commonUtils.sendError(req, res, {message: AppStrings.USER_NOT_FOUND})
    }

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
        const group = await Group.findOne({
            _id: groupId
        })
        if (!group) return commonUtils.sendError(req, res, {message: AppStrings.GROUP_NOT_FOUND})

        if (!group.admins.includes(adminid)) {
            return commonUtils.sendError(req, res, {message: AppStrings.ADMIN_ERROR})
        }

        if (!group.members.includes(userId)) {
            return commonUtils.sendError(req, res, {message: AppStrings.MEMBER_NOT_FOUND})
        }

        if (group.admins.includes(userId)) {
            return commonUtils.sendError(req, res, {message: AppStrings.ALREADY_AN_ADMIN})
        }


        let blockedByCreator = await Block.find({
            user_id: adminid,
            deleted: 0
        }).select("blocked_id")

        let blockedByMembers = await Block.find({
            blocked_id: userId,
            deleted: 0
        }).select("user_id")

        let blocked = blockedByCreator.map((value: any) => value.blocked_id)
        let blockedMem = blockedByMembers.map((value: any) => value.user_id)
        if (!blockedMem.includes(userId) && !blocked.includes(userId)) {

            const convMember: any = {
                senderId: userId,
                chatId: group.chatId,
                groupId: group._id,
                clearedAt: moment().valueOf(),
                pin: false,
                mute: false,
                deleted: false,
                active: true,
                type: convType.GROUP
            }
            await Conversation.create(convMember)

            io.sockets.sockets.get(userMapMobile[userId.toString()] ?? "")?.join(group.chatId?.toString())
            userMap[userId.toString()]?.forEach((data: any) => {
                io.sockets.sockets.get(data)?.join(group.chatId?.toString())
            })

            const indexMember = group.members.indexOf(userId);

            if (indexMember !== -1) {
                group.members.splice(indexMember, 1);
            }

            group.admins.push(userId)
            await group.save()

            let adminUserDetails = await UserProfile.findOne({
                _id: adminid
            })

            let affectedUserDetails = await UserProfile.findOne({
                _id : userId
            })

            let groupEventData: any = {}
            groupEventData.type = groupEvents.ASSIGN_ADMIN
            groupEventData.actionUserId = adminid
            groupEventData.actionUserDetail = adminUserDetails?.name
            groupEventData.affectedUserId = userId
            groupEventData.affectedUserDetail = affectedUserDetails?.name


            const messageData: any = {
                mId: randomUUID(),
                message: JSON.stringify(groupEventData),
                msgType: MsgType.EVENT,
                readStatus: MessageStatusEnum.SENT,
                convType: convType.GROUP,
                deletedStatus: 0,
                senderId: adminid,
                receiverId: group._id,
                groupId: group._id,
                chatId: group.chatId,
            }

            await Chat.create(messageData)
            messageData.createdDate = Date.now()
            messageData.updatedDate = Date.now()

            let offlineUser: any = []
            await Promise.all(group.members.concat(group.admins).map(async (value: any) => {
                let receiverSockId = userMapMobile[value.toString()]

                if (receiverSockId) {
                    io.sockets.sockets.get(receiverSockId)?.emit("groupMessage", messageData)
                } else {
                    if (adminid.toString() !== value.toString()) {
                        const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                        offlineUser.push({
                            pushToken,
                            userId: value.toString()
                        })
                    }

                    // TODO
                    // SAVE SYNC INFO : MESSAGE
                    await redisClient.lpush(value, JSON.stringify({
                        ...messageData,
                        ...{
                            "syncType": AppConstants.SYNC_TYPE_MESSAGE
                        }
                    }));
                }
                const webChat = userMap[value.toString()]
                if (!_.isEmpty(webChat)) {
                    webChat?.map((e: any) => {
                        if (e) {
                            io.sockets.sockets.get(e)?.emit("groupMessage", messageData)
                        }
                    })
                }
            }))
            await sendGroupNotification(offlineUser, adminid, group.name, messageData)

            return commonUtils.sendSuccess(req, res, {message: AppStrings.MEMBER_ADDED})
        } else {
            // TODO : user block message
        }
    }

    return commonUtils.sendError(req, res, {message: AppStrings.PARAMS_IS_REQUIRED})
}

async function removeGroupAdmin(req: Request, res: Response) {
    let adminid = req.headers.userid

    let {
        groupid: groupId,
        userid: userId
    } = req.params

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const user_ = await User.findOne({
            _id: userId,
        })
        if (!user_) return commonUtils.sendError(req, res, {message: AppStrings.USER_NOT_FOUND})
    }

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
        const group = await Group.findOne({
            _id: groupId
        })
        if (!group) return commonUtils.sendError(req, res, {message: AppStrings.GROUP_NOT_FOUND})

        if (!group.admins.includes(adminid)) {
            return commonUtils.sendError(req, res, {message: AppStrings.ADMIN_ERROR})
        }


        let blockedByCreator = await Block.find({
            user_id: adminid,
            deleted: 0
        }).select("blocked_id")

        let blockedByMembers = await Block.find({
            blocked_id: userId,
            deleted: 0
        }).select("user_id")

        let blocked = blockedByCreator.map((value: any) => value.blocked_id)
        let blockedMem = blockedByMembers.map((value: any) => value.user_id)
        if (!blockedMem.includes(userId) && !blocked.includes(userId)) {


            const indexAdmin = group.admins.indexOf(userId);

            if (indexAdmin !== -1) {
                group.admins.splice(indexAdmin, 1);
                group.members.push(userId)
            } else {
                return commonUtils.sendError(req, res, {message: AppStrings.ADMIN_NOT_FOUND})
            }


            await group.save()

            let adminUserDetails = await UserProfile.findOne({
                _id: adminid
            })

            let affectedUserDetails = await UserProfile.findOne({
                _id : userId
            })

            let groupEventData: any = {}
            groupEventData.type = groupEvents.REMOVE_ADMIN
            groupEventData.actionUserId = adminid
            groupEventData.actionUserDetail = adminUserDetails?.name
            groupEventData.affectedUserId = userId
            groupEventData.affectedUserDetail = affectedUserDetails?.name



            const messageData: any = {
                mId: randomUUID(),
                message: JSON.stringify(groupEventData),
                msgType: MsgType.EVENT,
                readStatus: MessageStatusEnum.SENT,
                convType: convType.GROUP,
                deletedStatus: 0,
                senderId: adminid,
                receiverId: group._id,
                groupId: group._id,
                chatId: group.chatId,
            }

            await Chat.create(messageData)
            messageData.createdDate = Date.now()
            messageData.updatedDate = Date.now()

            let offlineUser: any = []
            await Promise.all(group.members.concat(group.admins).map(async (value: any) => {
                let receiverSockId = userMapMobile[value.toString()]

                if (receiverSockId) {
                    io.sockets.sockets.get(receiverSockId)?.emit("groupMessage", messageData)
                } else {
                    if (adminid.toString() !== value.toString()) {
                        const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                        offlineUser.push({
                            pushToken,
                            userId: value.toString()
                        })
                    }

                    // TODO
                    // SAVE SYNC INFO : MESSAGE
                    await redisClient.lpush(value, JSON.stringify({
                        ...messageData,
                        ...{
                            "syncType": AppConstants.SYNC_TYPE_MESSAGE
                        }
                    }));
                }
                const webChat = userMap[value.toString()]
                if (!_.isEmpty(webChat)) {
                    webChat?.map((e: any) => {
                        if (e) {
                            io.sockets.sockets.get(e)?.emit("groupMessage", messageData)
                        }
                    })
                }
            }))

            io.sockets.sockets.get(userMapMobile[userId.toString()] ?? "")?.leave(group.chatId?.toString())
            userMap[userId.toString()]?.forEach((data: any) => {
                io.sockets.sockets.get(data)?.leave(group.chatId?.toString())
            })

            await sendGroupNotification(offlineUser, adminid, group.name, messageData)
            return commonUtils.sendSuccess(req, res, AppStrings.MEMBER_REMOVED)

        } else {
            // TODO : user block message
        }
    }
}

export default {
    blockedUsers,
    blockUnblockUser,
    registerChatUser,
    updateChatUser,
    uploadImage,
    uploadFile,
    uploadAudio,
    uploadVideo,
    createGroup,
    groupMembers,
    addMember,
    removeMember,
    deleteGroup,
    addGroupAdmin,
    removeGroupAdmin,
    updateGroup,
    leaveGroup,
    sendGroupNotification
}