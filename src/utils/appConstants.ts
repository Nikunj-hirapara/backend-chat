const config = require("config")

export const AppConstants = {
    "API_ROUTE_SOCKET": "",
    "IMAGE_PATH": config.get("ROUTE_URL") + "/uploads/images/",
    "AUDIO_PATH": config.get("ROUTE_URL") + "/uploads/audio/",
    "VIDEO_PATH": config.get("ROUTE_URL") + "/uploads/video/",

    "MODEL_USER": 'User',
    "MODEL_EVENT": 'Event',
    "MODEL_ADMIN": 'Admin',
    "MODEL_BUSINESS": 'Business',
    "MODEL_ROLE": 'AdminRole',
    "MODEL_CATEGORY": 'Category',
    "MODEL_IMAGE": 'Image',
    "MODEL_TOKEN": 'Token',
    "MODEL_CHAT": 'Chat',
    "MODEL_CONVERSATION": 'Conversation',
    "MODEL_USER_PROFILE": 'userProfile',
    "MODEL_LOCATION_TRACE": 'locationTrace',
    "MODEL_BLOCKED_USERS": 'blockUser',
    "MODEL_GROUP": 'Group',
    "MODEL_EVENT_BLOCK":'blockEvent',
    "MODEL_CHAT_CATEGORY": 'chatCategory',
    "MODEL_NOTIFICATION": 'notification',
    "MODEL_USER_HISTORY": 'userHistory',
    
    "GIVEN": 'given',
    "RECEIVED": 'received',
    "JOB_ID": 'job_id',

    "TOKEN_EXPIRY_TIME": '5m',
    "DATE_FORMAT": "yyyy-MM-DD HH:mm:ss.SSS",
    "ONLY_DATE_FORMAT": "yyyy-MM-DD",
    "DATE_FORMAT_SHORT": "yyyy-MM-DD HH:mm:ss",
    "DATE_FORMAT_WITH_AM_OR_PM": "YYYY-MM-DD hh:mm a",
    "DISTANCE_LIMIT_IN_METER": 500,
    "SYNC_TYPE_MESSAGE": "SYNC_MESSAGE",
    "SYNC_TYPE_EDIT_MESSAGE": "SYNC_EDIT_MESSAGE",
    "SYNC_TYPE_DELETE_MESSAGE": "SYNC_DELETE_MESSAGE",
    "SYNC_TYPE_BUSINESS_CHAT": "SYNC_BUSINESS_CHAT",
    "SYNC_TYPE_MESSAGE_STATUS": "SYNC_MESSAGE_STATUS",
    "SYNC_TYPE_BLOCK_UNBLOCK": "SYNC_BLOCK_UNBLOCK",
    "SYNC_TYPE_DELETE_ALL_CHAT" : "SYNC_DELETE_ALL_CHAT",
    "REGX_PAN_CARD": "[A-Z]{5}[0-9]{4}[A-Z]{1}",
    "REGX_ADHAR_CARD": "^[2-9]{1}[0-9]{3}[0-9]{4}[0-9]{4}$",
    "REGX_SSN_ID": "^(?!666|000|9\\d{2})\\d{3}-(?!00)\\d{2}-(?!0{4})\\d{4}$",
}

declare global {
    interface String {
        isExists(): boolean;

        isEmpty(): boolean;
    }

    interface Number {
        isExists(): boolean;
    }

    interface Boolean {
        isExists(): boolean;
    }
}

String.prototype.isExists = function () {
    return !(typeof (this) == 'undefined' || this == null);
}
String.prototype.isEmpty = function () {
    return (this) == "";
}

Number.prototype.isExists = function () {
    return !(typeof (this) == 'undefined' || this == null);
}

Boolean.prototype.isExists = function () {
    return !(typeof (this) == 'undefined' || this == null);
}