import {connectedUsers, io, userMap, userMapMobile} from "../../index";
import mongoose from "mongoose";
import redisClient from "../../utils/redisHelper";
import moment from "moment";
import {AppConstants} from "../../utils/appConstants";
import {Socket} from "socket.io";
import {convType, groupEvents, MessageStatusEnum, MsgType, NotificationType} from "../../utils/enum";
import commonUtils from "../../utils/commonUtils";
import {AppStrings} from "../../utils/appStrings";
import {randomUUID} from "crypto";

import chatController from "./chatController";

const {v4} = require('uuid');
var _ = require('lodash');

const UserProfile = require("./models/userProfile")
const Conversation = require("../chat/models/conversationModel")
const ChatMessage = require("../chat/models/chatModel")
const User = require('../users/models/userModel');
const Group = require('./models/groupModel');
const Block = require('./models/blockUsers');


export const connectionHandler = async (socket: any) => {
    let userId = socket.handshake.query['userId']?.toString() ?? "0"
    let deviceType = socket.handshake.query['device']?.toString() ?? "w"

    console.log("CONNECTED ", userId, deviceType)

    if(!mongoose.Types.ObjectId.isValid(userId)) return false

    if (deviceType !== "m") {

        if (userMap[userId] === undefined) userMap[userId] = []

        if (!userMap[userId].includes(socket.id)) {
            userMap[userId].push(socket.id)
        }

    } else {
        userMapMobile[userId] = socket.id
    }
    connectedUsers[socket.id] = {
        "userId": userId,
        "device": deviceType
    }
    io.in(`OUT_${userId}`).emit("online", {
        "from": userId,
        "status": 1
    })

    try {
        const pipline = [
            {
                $match: {
                    senderId: new mongoose.Types.ObjectId(userId),
                }
            },
            {
                $lookup: {
                    from: 'blockusers',
                    let: {receiverId: "$receiverId", senderId: "$senderId"},
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    {$eq: ["$user_id", "$$receiverId"]},
                                    {$eq: ["$blocked_id", "$$senderId"]},
                                    {$eq: ["$deleted", 0]},
                                ]
                            }
                        }
                    }],
                    as: 'blockByThem'
                }
            }, {
                $unwind: {
                    path: '$blockByThem',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'blockusers',
                    let: {receiverId: "$receiverId", senderId: "$senderId"},
                    pipeline: [{
                        $match: {
                            $expr: {
                                $and: [
                                    {$eq: ["$user_id", "$$senderId"]},
                                    {$eq: ["$blocked_id", "$$receiverId"]},
                                    {$eq: ["$deleted", 0]},
                                ]
                            }
                        }
                    }],
                    as: 'blockByMe'
                }
            }, {
                $unwind: {
                    path: '$blockByMe',
                    preserveNullAndEmptyArrays: true
                }
            },
        ]
        let conversation = await Conversation.aggregate(pipline).project("receiverId blockByMe blockByThem")

        let rooms = conversation.filter((data: any) => !data.hasOwnProperty("blockByMe") && !data.hasOwnProperty("blockByThem")).map((doc: any) => doc.receiverId)
        rooms = rooms?.map((value: any) => `OUT_${value}`)
        socket.join(rooms)
        // socket.join(conversation.filter((data: any) => !data.hasOwnProperty("blockByMe") && !data.hasOwnProperty("blockByThem")).map((doc: any) => doc.receiverId?.toString()).map((value: any) => value))

        const groupJoins = await Conversation.find({senderId: new mongoose.Types.ObjectId(userId), type: 3}).distinct('chatId')

        socket.join(groupJoins?.map((e: any) => e?.toString()) ?? [])

    } catch (e) {
        console.log("USER_IDD: ", userId, " ", deviceType, " ", e)
    }

    /**
     *  @description: Offline Sync
     *  @param {userId}
     * */
    socket.on("offlineSync", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)
        let {userId} = data

        let offlineData = await redisClient.lrange(userId, 0, -1)
        console.log("OFFLINE ", offlineData)
        if (!!offlineData) {
            ack(offlineData)
            await redisClient.del(userId)
        } else {
            console.log('check for empty')
            ack([])
        }
    })


    /**
     *  @description: Join Rooms
     *  @param rooms[] list of room ids
     * */
    socket.on("join", async (data: any) => {
        if (typeof data == 'string') data = JSON.parse(data)
        // let {rooms} = data
        // rooms = rooms?.map((value: any) => `OUT_${value}`)
        // socket.join(rooms)

        let conversation = await Conversation.find({senderId: data.userId}).distinct("receiverId")
        const rooms = conversation.map((value: any) => `OUT_${value}`)
        socket.join(rooms)
    })

    /**
     *  @description: dummy event for connection check
     *  @param rooms[]
     * */
    socket.emit("confirmConnect", {connection: true})

    /**
     * @description: create conversation event handler
     * @param {type, from: userId , to: otherUserId}
     */
    socket.on("createConversation", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)
        // console.log("createConversation: ", data)

        try {
            let {
                to,
                from,
                type
            } = data

            if (!to || !mongoose.Types.ObjectId.isValid(to)) return false
            if (!from || !mongoose.Types.ObjectId.isValid(from)) return false
            if (to === from) return false

            const user = await User.findById(to);
            if (!user) return false

            let success = true

            /**
             *    FIND CONVERSATION
             * */
            const pipline = [
                {
                    $match: {
                        senderId: new mongoose.Types.ObjectId(from),
                        receiverId: new mongoose.Types.ObjectId(to),
                        type: type ?? 1
                    }
                },
                {
                    $lookup: {
                        from: 'userprofiles',
                        localField: 'receiverId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    $unwind: {
                        path: '$user',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: 'blockusers',
                        let: {receiverId: "$receiverId", senderId: "$senderId"},
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $and: [
                                        {$eq: ["$user_id", "$$receiverId"]},
                                        {$eq: ["$blocked_id", "$$senderId"]},
                                        {$eq: ["$deleted", 0]},
                                    ]
                                }
                            }
                        }],
                        as: 'blockByThem'
                    }
                }, {
                    $unwind: {
                        path: '$blockByThem',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $lookup: {
                        from: 'blockusers',
                        let: {receiverId: "$receiverId", senderId: "$senderId"},
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $and: [
                                        {$eq: ["$user_id", "$$senderId"]},
                                        {$eq: ["$blocked_id", "$$receiverId"]},
                                        {$eq: ["$deleted", 0]},
                                    ]
                                }
                            }
                        }],
                        as: 'blockByMe'
                    }
                }, {
                    $unwind: {
                        path: '$blockByMe',
                        preserveNullAndEmptyArrays: true
                    }
                },

            ]
            let conversation = await Conversation.aggregate(pipline)

            const convChatId = new mongoose.Types.ObjectId()
            let conv;
            if (conversation.length === 0) {
                const convoData: any = {
                    senderId: from,
                    receiverId: to,
                    chatId: convChatId,
                    clearedAt: moment().valueOf(),
                    pin: false,
                    mute: false,
                    deleted: false,
                    active: true,
                    type: type ?? 1
                }

                const convoDataOther: any = {
                    senderId: to,
                    receiverId: from,
                    chatId: convChatId,
                    clearedAt: moment().valueOf(),
                    pin: false,
                    mute: false,
                    deleted: false,
                    active: true,
                    type: type ?? 1
                }

                const convMe = await Conversation.create(convoData)
                await Conversation.create(convoDataOther)
                conv = {
                    ...convMe._doc,
                    ...{
                        user: await UserProfile.findOne({_id: to}).select('_id name image').lean()
                    }
                };

                // console.log("CREATEEE  ", conv);
            } else {
                conv = conversation[0]
                // console.log("CONVVV ", conv);
            }

            conv.id = conv._id
            conv.online = !!userMap[conv.receiverId] || !!userMapMobile[conv.receiverId]
            conv.createdDate = moment(conv.createdAt).valueOf()
            conv.updatedDate = moment(conv.updatedAt).valueOf()
            conv.blockByMe = !!conv.blockByMe ? 1 : 0
            conv.blockByThem = !!conv.blockByThem ? 1 : 0

            conv.success = success
            ack(conv)
        } catch (error: any) {
            console.log(error);
        }
    })

    /**
     * @description: create group conversation event handler
     * @param {type, from: userId , to: otherUserId}
     */
    socket.on("createGroupConversation", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)


        try {
            let {
                userId,
                groupId,
                isJoin
            } = data

            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return false
            const conv_ = await Conversation.findOne({
                groupId: groupId,
                senderId: userId
            })


            if (!conv_) {

                const group = await Group.findOne({
                    _id: groupId
                })

                if (!group) return false


                let blockedByCreator = await Block.find({
                    user_id: {
                        $in: group.admins
                    },
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
                        return false
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

                    io.sockets.sockets.get(userMapMobile[userId.toString()] ?? "")?.join(group?.chatId?.toString())
                    userMap[userId.toString()]?.forEach((data: any) => {
                        io.sockets.sockets.get(data)?.join(group?.chatId?.toString())
                    })

                    group.members.push(userId)
                    await group.save()

                    const {name: userName} = await UserProfile.findById(userId)

                    let groupEventData: any = {}
                    groupEventData.type = isJoin ? groupEvents.JOIN_MEMBER : groupEvents.ADD_MEMBER
                    groupEventData.actionUserId = userId
                    groupEventData.actionUserDetail = userName
                    groupEventData.affectedUserId = userId
                    groupEventData.affectedUserDetail = userName


                    const messageData: any = {
                        mId: randomUUID(),
                        message: JSON.stringify(groupEventData),
                        msgType: MsgType.EVENT,
                        readStatus: MessageStatusEnum.SENT,
                        convType: convType.GROUP,
                        deletedStatus: 0,
                        senderId: userId,
                        receiverId: group._id,
                        chatId: group.chatId,
                    }

                    let message = await ChatMessage.create(messageData)
                    let offlineUser: any = {
                        pushToken: [],
                        userIds: [],
                    }
                    await Promise.all(group.members.concat(group.admins).map(async (value: any) => {
                        let receiverSockId = userMapMobile[value.toString()]

                        if (receiverSockId) {

                            io.sockets.sockets.get(receiverSockId)?.emit("groupMessage", messageData)
                        } else {
                            if (userId.toString() !== value.toString()) {
                                const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                                offlineUser.pushToken.push(pushToken)
                                offlineUser.userIds.push(value.toString())
                            }

                            // TODO
                            // SAVE SYNC INFO : MESSAGE
                            await redisClient.lpush(value, JSON.stringify({
                                ...message._doc,
                                ...{
                                    "syncType": AppConstants.SYNC_TYPE_MESSAGE
                                }
                            }));
                        }

                        const webChat = userMap[value.toString()]
                        if (!_.isEmpty(webChat)) {
                            await Promise.all(webChat?.map(async (e: any) => {
                                if (e) {
                                    io.sockets.sockets.get(e)?.emit("groupMessage", messageData)
                                } else {

                                    // TODO
                                    // SAVE SYNC INFO : MESSAGE
                                    await redisClient.lpush(e, JSON.stringify({
                                        ...message._doc,
                                        ...{
                                            "syncType": AppConstants.SYNC_TYPE_MESSAGE
                                        }
                                    }));
                                }
                            }))
                        }
                    }))
                    await chatController.sendGroupNotification(offlineUser, userId, group.name, messageData)

                }
            }

            let success = true

            /**
             *    FIND CONVERSATION
             * */
            const pipline = [
                {
                    $match: {
                        senderId: new mongoose.Types.ObjectId(userId),
                        groupId: new mongoose.Types.ObjectId(groupId),
                        type: 3
                    }
                },
                {
                    $lookup: {
                        from: 'groups',
                        localField: 'groupId',
                        foreignField: '_id',
                        as: 'groupData'
                    }
                },
                {
                    $unwind: {
                        path: '$groupData',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $lookup: {
                        from: 'userprofiles',
                        localField: 'groupData.members',
                        foreignField: '_id',
                        as: 'members'
                    }
                },
                {
                    $lookup: {
                        from: 'userprofiles',
                        localField: 'groupData.admins',
                        foreignField: '_id',
                        as: 'admins'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        id: "$_id",
                        senderId: "$senderId",
                        groupId: "$groupId",
                        chatId: "$chatId",
                        clearedAt: "$clearedAt",
                        type: "$type",
                        pin: "$pin",
                        mute: "$mute",
                        deleted: "$deleted",
                        active: "$active",
                        createdById: "$userId",
                        createdByName: "$userName",
                        createdAt: "$createdAt",
                        updatedAt: "$updatedAt",
                        admins: "$admins",
                        members: "$members",
                        groupData: {
                            $cond: {
                                if: "$groupData",
                                then: {
                                    _id: "$groupData._id",
                                    name: "$groupData.name",
                                    description: "$groupData.description",
                                    image: "$groupData.image",
                                    memberCount: {$size: "$groupData.members"},
                                    createdById: "$groupData.userId",
                                    createdByName: "$groupData.userName",
                                    geoTag: "$groupData.geoTag",
                                    private: "$groupData.private"

                                },
                                else: {
                                    _id: "",
                                    name: "",
                                    description: "",
                                    image: "",
                                    memberCount: 0,
                                    createdById: "",
                                    createdByName: "",
                                    geoTag: {},
                                    private: false
                                }
                            }
                        },
                    }
                },

            ]
            let conversation = await Conversation.aggregate(pipline)

            let conv: any;
            if (conversation.length) {
                ack(conversation[0])
            } else {
                ack({"status": false})
            }

        } catch (error: any) {
            console.log(error);
        }
    })

    /**
     *  @description: list of conversations
     *  @param userId
     * */
    socket.on("listChats", async (data: any, ack: any) => {
        console.log('check on reload get here');

        if (typeof data == 'string') data = JSON.parse(data)
        const {userId} = data

        try {
            const pipline = [
                {
                    $match: {
                        senderId: new mongoose.Types.ObjectId(userId),
                        type: 1
                    }
                },
                {
                    $lookup: {
                        from: 'userprofiles',
                        localField: 'receiverId',
                        foreignField: '_id',
                        as: 'user'
                    }
                }, {
                    $lookup: {
                        from: 'chats',
                        let: {
                            recId: "$receiverId",
                            user_id: new mongoose.Types.ObjectId(userId)
                        },
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $or: [
                                        {
                                            $and: [
                                                {$eq: ['$receiverId', '$$user_id']},
                                                {$eq: ['$senderId', '$$recId']}
                                            ]
                                        }, {
                                            $and: [
                                                {$eq: ['$senderId', '$$user_id']},
                                                {$eq: ['$receiverId', '$$recId']}
                                            ]
                                        }
                                    ]
                                }
                            }
                        }, {
                            $sort: {createdAt: -1}
                        }, {
                            $limit: 1
                        }],
                        as: 'message'
                    }
                },
                {
                    $lookup: {
                        from: 'chats',
                        let: {
                            recId: "$receiverId",
                            user_id: new mongoose.Types.ObjectId(userId)
                        },
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $and: [
                                        {$eq: ['$receiverId', '$$user_id']},
                                        {$eq: ['$senderId', '$$recId']},
                                        {$lt: ['$readStatus', 3]}
                                    ]
                                }
                            }
                        }, {
                            $count: "unreadCount"
                        }, {
                            $project: {unreadCount: 1}
                        }],
                        as: 'unreadCount'
                    }
                },
                {
                    $unwind: {
                        path: '$user',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $unwind: {
                        path: '$message',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $unwind: {
                        path: '$unreadCount',
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]

            let conversation = await Conversation.aggregate(pipline)

            conversation = conversation.map((value: any) => {
                return {
                    ...value,
                    ...{
                        "unreadCount": value?.unreadCount?.unreadCount,
                        "messageDate": value.message ? moment(value.message.createdAt).valueOf() : 0,
                        "timestamp": value.message ? value.message.createdAt : null,
                        "mId": value.message?.mId,
                        "message": value.message?.message,
                        "msgType": value.message?.msgType,
                        "readStatus": value.message?.readStatus,
                        "deletedStatus": value.message?.deletedStatus,
                        "messageSenderId": value.message?.senderId,
                        "messageReceiverId": value.message?.receiverId,
                        "isForwarded": value.message?.isForwarded,
                    },
                    ...{
                        id: value._id,
                        online: !!userMap[value.receiverId] || !!userMapMobile[value.receiverId]
                    }
                }
            })

            ack(conversation)
        } catch (e: any) {
            console.log(e)
            ack(e.message)
        }

    })

    /**
     *  @description: group list of conversations
     *  @param userId
     * */
    socket.on("groupListChats", async (data: any, ack: any) => {
        console.log('check on reload get here');

        if (typeof data == 'string') data = JSON.parse(data)
        const {userId} = data

        try {

            const piplineBusiness = [
                {
                    $match: {
                        senderId: new mongoose.Types.ObjectId(userId),
                        type: convType.GROUP
                    }
                },
                {
                    $lookup: {
                        from: 'groups',
                        localField: 'groupId',
                        foreignField: '_id',
                        as: 'groupData'
                    }
                }, {
                    $lookup: {
                        from: 'chats',
                        let: {
                            recId: "$groupId",
                            user_id: new mongoose.Types.ObjectId(userId)
                        },
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $or: [
                                        {
                                            $and: [
                                                {$eq: ['$receiverId', '$$user_id']},
                                                {$eq: ['$senderId', '$$recId']}
                                            ]
                                        }, {
                                            $and: [
                                                {$eq: ['$senderId', '$$user_id']},
                                                {$eq: ['$receiverId', '$$recId']}
                                            ]
                                        }
                                    ]
                                }
                            }
                        }, {
                            $sort: {createdAt: -1}
                        }, {
                            $limit: 1
                        }],
                        as: 'message'
                    }
                },
                {
                    $lookup: {
                        from: 'chats',
                        let: {
                            recId: "$groupId",
                            user_id: new mongoose.Types.ObjectId(userId)
                        },
                        pipeline: [{
                            $match: {
                                $expr: {
                                    $and: [
                                        {$eq: ['$receiverId', '$$user_id']},
                                        {$eq: ['$senderId', '$$recId']},
                                        {$lt: ['$readStatus', 3]}
                                    ]
                                }
                            }
                        }, {
                            $count: "unreadCount"
                        }, {
                            $project: {unreadCount: 1}
                        }],
                        as: 'unreadCount'
                    }
                },
                {
                    $unwind: {
                        path: '$groupData',
                        preserveNullAndEmptyArrays: true
                    }
                }, {
                    $unwind: {
                        path: '$message',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $unwind: {
                        path: '$unreadCount',
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]

            let groupConversations = await Conversation.aggregate(piplineBusiness)


            let conversation = [].concat(groupConversations).map((value: any) => {
                return {
                    ...value,
                    ...{
                        "unreadCount": value?.unreadCount?.unreadCount,
                        "messageDate": value.message ? moment(value.message.createdAt).valueOf() : 0,
                        "timestamp": value.message ? value.message.createdAt : null,
                        "mId": value.message?.mId,
                        "message": value.message?.message,
                        "msgType": value.message?.msgType,
                        "readStatus": value.message?.readStatus,
                        "deletedStatus": value.message?.deletedStatus,
                        "messageSenderId": value.message?.senderId,
                        "messageReceiverId": value.message?.receiverId,
                        "isForwarded": value.message?.isForwarded,
                        createdById: value.groupData?.userId,
                        createdByName: value.groupData?.userName || "",
                    },
                    ...{
                        id: value._id,
                        online: !!userMap[value.receiverId] || !!userMapMobile[value.receiverId]
                    }
                }
            })

            // console.log('business conversation',conversation);

            ack(conversation)
        } catch (e: any) {
            console.log(e)
            ack(e.message)
        }

    })


    /**
     * @description: typing event handler
     * @param {type, userId}
     */
    socket.on("typing", async (data: any) => {
        if (typeof data == 'string') data = JSON.parse(data)
        let toUser = data.to ?? ""
        let type = data.type ?? 1

        if (type == 1) {
            userMap[toUser]?.forEach((value: any) => io.to(value)?.emit("typing", data))
            io.sockets.sockets.get(userMapMobile[toUser])?.emit("typing", data)
        } else {
            io.to(toUser.toString())?.emit("typing", data)
        }
    })

    /**
     * @description: edit message
     * */
    socket.on("editMessage", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        let {
            mId, message, userId
        } = data

        await ChatMessage.updateOne({
            mId: mId
        }, {
            $set: {
                message: message
            }
        })

        const messageObj = await ChatMessage.findOne({mId: mId}).exec()

        if (messageObj) {
            if (messageObj.convType === 1) {
                const receiverId = messageObj.receiverId.toString();
                //web
                userMap[receiverId]?.forEach((value: any) => io.to(value)?.emit("editMessage", messageObj))

                //mobile
                if (userMapMobile[receiverId]) {
                    io.sockets.sockets.get(userMapMobile[receiverId])?.emit("editMessage", messageObj)
                } else {
                    // SAVE SYNC INFO : MESSAGE
                    await redisClient.lpush(receiverId, JSON.stringify({
                        ...messageObj._doc,
                        ...{
                            "syncType": AppConstants.SYNC_TYPE_EDIT_MESSAGE
                        }
                    }));
                }
            } else if (messageObj.convType === 3) {
                const {members, admins} = await Group.findById(messageObj.groupId)

                socket.to(messageObj.chatId.toString())?.emit("editMessage", messageObj)
                await Promise.all(members.concat(admins).map(async (value: any) => {
                    let receiverSockId = userMapMobile[value.toString()]
                    //web
                    userMap[receiverSockId]?.forEach((value: any) => io.to(value)?.emit("editMessage", messageObj))

                    if (!receiverSockId && userId.toString() !== value.toString()) {
                        /*const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                        offlineUser.push({
                            pushToken,
                            userId: value.toString()
                        })*/
                        // SAVE SYNC INFO : MESSAGE
                        await redisClient.lpush(value.toString(), JSON.stringify({
                            ...messageObj._doc,
                            ...{
                                "syncType": AppConstants.SYNC_TYPE_EDIT_MESSAGE
                            }
                        }));
                    }
                }))
            } else {

                const conversation = await Conversation.findOne({chatId: messageObj.chatId})
                socket.to(messageObj.chatId.toString())?.emit("editMessage", messageObj)

                await Promise.all([...conversation.employee, conversation.businessUserId, conversation.senderId].map(async (value: any) => {
                    let receiverSockId = userMapMobile[value.toString()]                    

                    if (!receiverSockId) {

                        // SAVE SYNC INFO : MESSAGE
                        await redisClient.lpush(value.toString(), JSON.stringify({...messageObj._doc, ...{"syncType": AppConstants.SYNC_TYPE_EDIT_MESSAGE}}));
                    } else {
                        io.sockets.sockets.get(userMapMobile[value.toString()])?.emit("editMessage", messageObj)
                    }
                }))


            }
        }

        ack(messageObj)
    })

    /**
     * @description: send message event handler
     * @param {}
     * */
    socket.on("message", async (data: any, ack: any) => {

        if (typeof data == 'string') data = JSON.parse(data)

        let {receiverId, senderId, message, msgType} = data

        const messageData: any = {
            mId: data.id || data.mId,
            message: message,
            msgType: msgType,
            readStatus: data.readStatus,
            deletedStatus: data.deletedStatus,
            geoTag: data.geoTag,
            senderId: senderId,
            receiverId: receiverId,
            convType: data.convType,
            isForwarded: data.isForwarded
        }
        const log = await ChatMessage.create(messageData)

        if(!data.createdDate) data.createdDate = moment(log.createdAt).valueOf();
        if(!data.updatedDate) data.updatedDate = moment(log.updatedAt).valueOf();
        if(!data.timeStamp) data.timeStamp = log.createdAt;

        userMap[receiverId.toString()]?.forEach((value: any) => io.to(value)?.emit("message", data))

        ack(data)

        if (userMapMobile[receiverId?.toString()]) {
            io.sockets.sockets.get(userMapMobile[receiverId?.toString()])?.emit("message", data)
        } else {
            // SEND NOTIFICATION TO DEVICE
            try {
                const pushToken = await User.getPushToken(receiverId); //get pushtoken of receiver user
                const sender = await User.findById(senderId); //get pushtoken of receiver user
                await commonUtils.sendNotification({
                    notification: {
                        title: AppStrings.PERSONAL_MESSAGE.TITLE.replace(':name', sender?.fullName ?? 'user'),
                        body: AppStrings.PERSONAL_MESSAGE.BODY.replace(':message', msgType !== MsgType.TEXT ? 'attachment' : message)
                    },
                    data: {
                        stringify: JSON.stringify({...data}),
                        senderId: senderId.toString(),
                        type: NotificationType.PERSONAL_MESSAGE.toString()
                    }
                }, pushToken, receiverId.toString())
            } catch (e: any) {
                console.log('chat single message error', e.messsage);
            }
            // notify code end

            // TODO
            // SAVE SYNC INFO : MESSAGE
            await redisClient.lpush(receiverId, JSON.stringify({
                ...data,
                ...{
                    "syncType": AppConstants.SYNC_TYPE_MESSAGE
                }
            }));
        }

    })

    /**
     * @description: send message event handler
     * @param {}
     * */
    socket.on("groupMessage", async (data: any, ack: any) => {

        if (typeof data == 'string') data = JSON.parse(data)

        const {senderId, message, msgType, groupId} = data

        const messageData: any = {
            mId: data.id || data.mId,
            message: message,
            msgType: msgType,
            readStatus: data.readStatus,
            convType: data.convType,
            deletedStatus: data.deletedStatus,
            geoTag: data.geoTag,
            senderId: data.senderId,
            receiverId: data.receiverId,
            groupId: groupId,
            chatId: data.chatId,
            isForwarded: data.isForwarded
        }
        const log = await ChatMessage.create(messageData)

        if(!data.createdDate) data.createdDate = moment(log.createdAt).valueOf();
        if(!data.updatedDate) data.updatedDate = moment(log.updatedAt).valueOf();
        if(!data.timeStamp) data.timeStamp = log.createdAt;

        socket.to(data.chatId)?.emit("groupMessage", data)

        const {name: groupName, members, admins} = await Group.findById(groupId)

        let offlineUser: any = []
        
        await Promise.all(members.concat(admins).map(async (value: any) => {
            let receiverSockId = userMapMobile[value.toString()]

            if (!receiverSockId && senderId.toString() !== value.toString()) {
                const pushToken = await User.getPushToken(value.toString()); //get pushtoken of group user
                offlineUser.push({
                    pushToken,
                    userId: value.toString()
                })
                // SAVE SYNC INFO : MESSAGE
                await redisClient.lpush(value.toString(), JSON.stringify({
                    ...data,
                    ...{
                        "syncType": AppConstants.SYNC_TYPE_MESSAGE
                    }
                }));
            }
        }))

        // SEND NOTIFICATION TO DEVICE
        if (offlineUser?.length) {
            try {
                const sender = await User.findById(senderId);
                await commonUtils.sendNotification({
                    notification: {
                        title: AppStrings.GROUP_MESSAGE.TITLE.replace(':name', sender?.fullName ?? 'user').replace(':group', groupName ?? 'group'),
                        body: AppStrings.GROUP_MESSAGE.BODY.replace(':message', msgType === MsgType.TEXT ? commonUtils.decodeGroupMessage(message)?.message : 'attachment')
                    },
                    data: {
                        stringify: JSON.stringify({...data}),
                        senderId: senderId.toString(),
                        type: NotificationType.GROUP_MESSAGE.toString()
                    }
                }, offlineUser, 'multiple')
            } catch (e: any) {
                console.log('chat group message error', e.messsage);
            }
        }
        // notify code end

        ack(data)

    })


    /**
     *  @description: get message list
     *  @param userId
     * */
    socket.on("getMessages", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        const {userId, receiverId, page} = data

        const page_ = parseInt(page as string) || 0;
        const limit_ = 15;
        const skip_ = (page_ - 1) * limit_;

        const messages = ChatMessage.find({
                $or: [
                    {senderId: userId, receiverId: receiverId},
                    {receiverId: userId, senderId: receiverId}
                ]
            }
        ).sort({createdAt: -1})
            .skip(skip_)

        const messages_ = messages.map((value: any) => {
            return {
                ...value, ...{
                    createdDate: moment(value.createdAt).valueOf(),
                    updatedDate: moment(value.updatedAt).valueOf(),
                }
            }
        })

        ack(messages_)

    })


    /**
     *  @description: get message list
     *  @param userId
     * */
    socket.on("getMessagesByLastId", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        const {userId, receiverId, lastId} = data


        let andFilter =
            {
                $or: [
                    {
                        receiverId: new mongoose.Types.ObjectId(userId),
                        senderId: new mongoose.Types.ObjectId(receiverId)
                    }, {
                        senderId: new mongoose.Types.ObjectId(userId),
                        receiverId: new mongoose.Types.ObjectId(receiverId)
                    }
                ],
                convType: convType.USER
            }

        if (lastId) {
            andFilter = {
                ...andFilter, ...{
                    // @ts-ignore
                    _id: {
                        $lt: new mongoose.Types.ObjectId(lastId)
                    }
                }
            }
        }

        let filterPipeline = [
            {
                $match: {
                    $and: [andFilter]
                }
            }, {
                $sort: {
                    createdAt: -1
                }
            }, {
                $limit: 15
            }
        ]

        const chatMessages = await ChatMessage.aggregate(filterPipeline)

        const messages = chatMessages.length ? chatMessages?.map((value: any) => {
            return {
                ...value, ...{
                    createdDate: moment(value.createdAt).valueOf(),
                    updatedDate: moment(value.updatedAt).valueOf(),
                }
            }
        }) : []

        ack(messages)

    })
    /**
     *  @description: get business message list
     *  @param userId
     * */
    socket.on("getMessagesUsingChatIdByLastId", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        const {chatId, lastId} = data


        let andFilter =
            {
                chatId: new mongoose.Types.ObjectId(chatId)
            }

        if (lastId) {
            andFilter = {
                ...andFilter,
                // @ts-ignore
                _id: {$lt: new mongoose.Types.ObjectId(lastId)}
            }
        }

        let filterPipeline = [
            {
                $match: andFilter
            },
            {
                $lookup: {
                    from: 'userprofiles',
                    localField: 'senderId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: {
                    path: '$user',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }, {
                $limit: 15
            },
        ]

        const chatMessages = await ChatMessage.aggregate(filterPipeline)

        const messages = chatMessages.length ? chatMessages?.map((value: any) => {
            return {
                ...value, ...{
                    createdDate: moment(value.createdAt).valueOf(),
                    updatedDate: moment(value.updatedAt).valueOf(),
                }
            }
        }) : []

        ack(messages)

    })

    /**
     * @description: when server disconnects from user
     */
    socket.on('disconnect', () => {
        console.log('disconnected from user');

        let userData = connectedUsers[socket.id];


        if (userData["device"] === "m") {
            delete userMapMobile[userData["userId"]]

        } else {
            let socketIndex = userMap[userData["userId"]]?.findIndex((value: any) => value === socket.id);

            if (socketIndex !== -1) {
                userMap[userId].splice(socketIndex);
            }
        }


        io.in(`OUT_${userId}`).emit("online", {
            "from": userId,
            "status": 0
        })

        delete connectedUsers[socket.id]

        socket.rooms.forEach((value: Socket) => socket.leave(value))
        socket.disconnect(true)

    });


    /**
     *  @description Delivery/Read Single/Read All message : common event
     *  @param {"to" : userId, "mId": message id}
     * */
    socket.on("messageStatus", async (data: any, ack: any) => {

        if (typeof data == 'string') data = JSON.parse(data)

        let {to, from, event, type, chatId} = data

        switch (event) {
            case "readMessage":
                await ChatMessage.updateOne({
                    mId: data.mId
                }, {
                    $set: {readStatus: 3}
                })
                break;
            case "readAllMessages":

                if (type == 2 || type == 3) {
                    await ChatMessage.updateMany({
                        senderId: {
                            $ne: new mongoose.Types.ObjectId(from)
                        },
                        chatId: chatId,
                        readStatus: {$lt: 3}
                    }, {
                        $set: {
                            readStatus: 3
                        }
                    })
                } else {
                    await ChatMessage.updateMany({
                        senderId: new mongoose.Types.ObjectId(to),
                        receiverId: new mongoose.Types.ObjectId(from),
                        readStatus: {$lt: 3}
                    }, {
                        $set: {
                            readStatus: 3
                        }
                    })
                }


                break;
            case "delivered":
                await ChatMessage.updateOne({
                    mId: data.mId
                }, {
                    $set: {readStatus: 2}
                })
                break;
        }


        if (type == 2 || type == 3) {
            socket.to(chatId)?.emit("messageStatus", data)

            await Promise.all((await io.to(chatId)?.fetchSockets())?.map(async (soc: any) => {

                let connected = connectedUsers[soc.id]

                if (!userMapMobile.hasOwnProperty(connected?.userId)) {
                    // TODO
                    // SAVE SYNC INFO : MESSAGE STATUS
                    await redisClient.lpush(connected.userId, JSON.stringify({
                        ...data,
                        ...{
                            "syncType": AppConstants.SYNC_TYPE_MESSAGE_STATUS
                        }
                    }));
                }
            }))
        } else {
            userMap[to]?.forEach((value: any) => io.sockets.sockets.get(value)?.emit("messageStatus", data))

            if (userMapMobile[to]) {
                io.sockets.sockets.get(userMapMobile[to])?.emit("messageStatus", data)
            } else {
                // TODO
                // SAVE SYNC INFO

                await redisClient.lpush(to, JSON.stringify({
                    ...data,
                    ...{
                        "syncType": AppConstants.SYNC_TYPE_MESSAGE_STATUS
                    }
                }))
            }
        }


    });

    /**
     *  @description online status for list of chat users
     *  @param chats - list of ids
     * */
    socket.on("onlineStatuses", (data: any) => {

        if (typeof data == 'string') data = JSON.parse(data)

        let {chats} = data

        let response = chats.map((v: any) => {
            return {
                "senderId": v,
                "status": !!userMap[v] || !!userMapMobile[v] ? 1 : 0
            }
        })

        socket.emit("onlineStatuses", response)

    })


    /**
     *  @description get chat ids for web app
     *  @param chats - list of ids
     * */
    socket.on("joinChatIds", async (data: any) => {

        if (typeof data == 'string') data = JSON.parse(data)

        let conversation = await Conversation.find({
            senderId: data.userId
        }).select("receiverId -_id")

        let rooms = conversation.map((doc: any) => doc.receiverId)
        rooms = rooms?.map((value: any) => `OUT_${value}`)
        socket.join(rooms)
    })

    socket.on("deleteMessage", async (body: any, ack: any) => {
        /**
         *   type : 1 - delete for me, 2 - delete for both
         *   userId(senderID) : xx
         *
         *   status - 1,2,3
         *   1 - Delete for sender
         *   2 - Delete for receiver
         *   3 - Delete for both
         *   4 - both side deleted
         *
         *
         *   if(type == 1)
         *      ==> senderId == userId ? status = 1 : status = 2
         *   else
         *      ==> status = 3
         *
         *
         *    update status =>  if 0 then status else 3
         * */


        if (typeof body == 'string') body = JSON.parse(body)

        let type = (body.type?.toString() ?? "1")
        let userId = body.userId?.toString() ?? "0"
        let mId = body.mId ?? []


        let message = await ChatMessage.find({
            mId: {
                $in: mId
            }
        })

        if (message.length) {

            let updatedMessage: any[] = []
            await Promise.all(message.map(async (data: any) => {
                let status = type === "1" ? (userId == data.senderId ? 1 : 2) : 3


                await ChatMessage.updateOne({
                    mId: data.mId
                }, {
                    $set: {
                        deletedStatus: data.deletedStatus === 0 ? status : 4
                    }
                })
                let messageUpdated = await ChatMessage.findOne({
                    mId: data.mId
                })

                console.log(messageUpdated);
                

                updatedMessage.push({
                    "mId": data.mId,
                    "deleteStatus": messageUpdated.deletedStatus,
                    "chatId": data.chatId
                })


                if (type !== "1") {
                    if (messageUpdated.convType === convType.USER.valueOf()) {

                        userMap[data.receiverId?.toString()]?.forEach((value: any) => io.to(value)?.emit("deleteMessage", {
                            "mId": data.mId,
                            "deleteStatus": messageUpdated.deletedStatus,
                            "chatId": data.chatId
                        }))

                        io.sockets.sockets.get(userMapMobile[data.receiverId?.toString()])?.emit("deleteMessage", {
                            "mId": data.mId,
                            "deleteStatus": messageUpdated.deletedStatus,
                            "chatId": data.chatId
                        })

                        if (!userMapMobile[data.receiverId?.toString() ?? ""]) {
                            await redisClient.lpush(data.receiverId?.toString(), JSON.stringify({
                                ...{
                                    "mId": data.mId,
                                    "deleteStatus": messageUpdated.deletedStatus,
                                    "chatId": data.chatId
                                },
                                ...{
                                    "syncType": AppConstants.SYNC_TYPE_DELETE_MESSAGE
                                }
                            }));
                        }

                    } else if (messageUpdated.convType === convType.GROUP.valueOf()) {

                        io.to(data.chatId?.toString())?.emit("deleteMessage", {
                            "mId": data.mId,
                            "deleteStatus": messageUpdated.deletedStatus,
                            "chatId": data.chatId
                        })

                        const {members, admins} = await Group.findById(messageUpdated.groupId)

                        socket.to(messageUpdated.chatId.toString())?.emit("deleteMessage", {
                            "mId": data.mId,
                            "deleteStatus": messageUpdated.deletedStatus,
                            "chatId": data.chatId
                        })
                        await Promise.all(members.concat(admins).map(async (value: any) => {
                            let receiverSockId = userMapMobile[value.toString()]


                            if (!receiverSockId && userId.toString() !== value.toString()) {
                                // SAVE SYNC INFO : MESSAGE
                                await redisClient.lpush(value.toString(), JSON.stringify({
                                    ...{
                                        "mId": data.mId,
                                        "deleteStatus": messageUpdated.deletedStatus,
                                        "chatId": data.chatId
                                    },
                                    ...{
                                        "syncType": AppConstants.SYNC_TYPE_DELETE_MESSAGE
                                    }
                                }));
                            }
                        }))

                    } else {
                        io.to(data.chatId?.toString())?.emit("deleteMessage", {
                            "mId": data.mId,
                            "deleteStatus": messageUpdated.deletedStatus,
                            "chatId": data.chatId
                        })

                        const conversation = await Conversation.findOne({chatId: data.chatId})

                        await Promise.all([...conversation.employee, conversation.businessUserId, conversation.senderId].map(async (value: any) => {
                            
                            let receiverSockId = userMapMobile[value.toString()]


                            if (!receiverSockId) {

                                // SAVE SYNC INFO : MESSAGE
                                await redisClient.lpush(value.toString(), JSON.stringify({
                                    ...{
                                        "mId": data.mId,
                                        "deleteStatus": messageUpdated.deletedStatus,
                                        "chatId": data.chatId
                                    }, ...{"syncType": AppConstants.SYNC_TYPE_DELETE_MESSAGE}
                                }));
                            }
                        }))
                    }


                }


            }))
            ack(updatedMessage)

        }

    })


    /**
     *  @description delete conversations
     *  @param deletedIds
     * */
    socket.on("deleteConversation", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        await Conversation.deleteMany({
            senderId: data.userId,
            receiverId: {
                $in: data.receiverIds
            }
        })
        ack(true)
    })

    /**
     *  @description close conversations
     *  @param chatId
     * */
    socket.on("closeConversation", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        await Conversation.updateOne({
            chatId: data.chatId,
        }, {
            $set: {
                active: false
            }
        })

        socket.to(data.chatId)?.emit("closeConversation", data)

        ack(true)
    })

    /**
     *  @description open conversations
     *  @param chatId
     * */
    socket.on("openConversation", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        await Conversation.updateOne({
            chatId: data.chatId,
        }, {
            $set: {
                active: false
            }
        })

        socket.to(data.chatId)?.emit("openConversation", data)

        ack(true)
    })


    /**
     *  @description clear conversations
     *  @param deletedIds
     * */
    socket.on("clearConversation", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        await Conversation.updateOne({
            senderId: data.userId,
            /*receiverId: {
                $in: data.receiverIds
            }*/
        }, {
            $set: {
                clearedAt: moment().valueOf()
            }
        })
        ack(true)
    })

    /**
     *  @description mute conversations
     *  @param deletedIds
     * */
    socket.on("muteConversation", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        let {
            userId,
            chatId,
            isMute
        } = data

        await Conversation.updateOne({
            senderId: userId,
            chatId: chatId,
        }, {
            $set: {
                mute: isMute
            }
        })


        ack(true)
    })

    /**
     *  @description submit location
     *  @param userId
     * */
    socket.on("submitLocation", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        let {
            to
        } = data

        console.log('submit location', data);


        let online = !!userMapMobile[to.toString()] || !!userMap[to.toString()]

        if (!online) {

        } else {
            io.sockets.sockets.get(userMapMobile[to.toString()])?.emit("submitLocation", data)
            io.sockets.sockets.get(userMap[to.toString()])?.emit("submitLocation", data)
        }
    })

    /**
     *  @description group conversation
     *  @param userId
     * */
    socket.on("groupConversation", async (data: any, ack: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        const ids: any[] = data.ids
        const {userId} = data

        const pipline = [
            {
                $match: /*ids ? {
                    senderId: new mongoose.Types.ObjectId(userId),
                    groupId: {
                        $nin: ids
                    },
                    type: 3
                } : */
                    {
                        senderId: new mongoose.Types.ObjectId(userId),
                        type: 3
                    }
            },
            {
                $lookup: {
                    from: 'groups',
                    localField: 'groupId',
                    foreignField: '_id',
                    as: 'groupData'
                }
            },
            {
                $unwind: {
                    path: '$groupData',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'userprofiles',
                    localField: 'groupData.members',
                    foreignField: '_id',
                    as: 'members'
                }
            },
            {
                $lookup: {
                    from: 'userprofiles',
                    localField: 'groupData.admins',
                    foreignField: '_id',
                    as: 'admins'
                }
            },
            {
                $project: {
                    _id: 1,
                    id: "$_id",
                    senderId: "$senderId",
                    groupId: "$groupId",
                    chatId: "$chatId",
                    clearedAt: "$clearedAt",
                    type: "$type",
                    pin: "$pin",
                    mute: "$mute",
                    deleted: "$deleted",
                    active: "$active",
                    createdById: "$userId",
                    createdByName: "$userName",
                    createdAt: "$createdAt",
                    updatedAt: "$updatedAt",
                    admins: "$admins",
                    members: "$members",
                    groupData: {
                        $cond: {
                            if: "$groupData",
                            then: {
                                _id: "$groupData._id",
                                name: "$groupData.name",
                                description: "$groupData.description",
                                image: "$groupData.image",
                                memberCount: {$size: "$groupData.members"},
                                createdById: "$groupData.userId",
                                createdByName: "$groupData.userName",
                                geoTag: "$groupData.geoTag",
                                private: "$groupData.private"
                            },
                            else: {
                                _id: "",
                                name: "",
                                image: "",
                                description: "",
                                memberCount: 0,
                                createdById: "",
                                createdByName: "",
                                geoTag: {},
                                private: false
                            }
                        }
                    },
                }
            },

        ]
        const conversation = await Conversation.aggregate(pipline)
        ack(conversation)
    })


    socket.on("deleteAllChat", async (data: any) => {
        if (typeof data == 'string') data = JSON.parse(data)

        let {groupId} = data


        const {members, admins, chatId} = await Group.findById(groupId)

        await ChatMessage.deleteMany({
            chatId: new mongoose.Types.ObjectId(chatId)
        })

        socket.to(chatId.toString())?.emit("deleteAllChat", {
            "groupId": groupId
        })

        await Promise.all(members.concat(admins).map(async (value: any) => {
            let receiverSockId = userMapMobile[value.toString()]


            if (!receiverSockId) {
                // SAVE SYNC INFO : MESSAGE
                await redisClient.lpush(value.toString(), JSON.stringify({
                    ...{
                        "groupId": groupId
                    },
                    ...{
                        "syncType": AppConstants.SYNC_TYPE_DELETE_ALL_CHAT
                    }
                }));
            }
        }))
    })

}