export enum UserData {
    USERNAME = 1,
    EMAIL = 2,
    MOBILE = 3,
    GOOGLE_ID = 4,
    FACEBOOK_ID = 5,
    APPLE_ID = 6,
}

export enum TrustLevel {
    SUPER_TRUSTED = 1,
    ABOVE_AVERAGE_TRUST = 2,
    AVERAGE_TRUST = 3,
    ALMOST_TRUST = 4,
    NOT_VERIFIED = 5,
    NOT_TRUSTED = 6
}

export enum Gender {
    MALE = 1,
    FEMALE = 2,
    TRANSGENDER = 3,
    NON_BINARY = 4,
    OTHER = 5,
}

export enum FriendStatus {
    REQUESTED = 1,
    PENDING = 2,
    FRIENDS = 3,
    REJECT = 4,
    BLOCK_BY_REQUESTER = 5,
    BLOCK_BY_RECIPIENT = 6,
}

export enum MicroComponent {
    DEFAULT = 0,
    BUSINESS = 1,
    TEXI = 2,
}

export enum Recognise {
    PENDING = 1,
    YESIKNOW = 2,
    DONTKNOW = 3,
    IGNORE = 4
}

export enum TrustStatus {
    PENDING = 1,
    INVALID = 2,
    ACCEPT = 3,
}


export enum Endorsed {
    INDIVIDUAL = 1,
    BUSINESS = 2,
}

export enum TrustFieldDependOn {
    USER_IMAGE = 1,
    USER_ID_NUMBER = 2,
    THREE_X_REFERENCES = 3,
    HOME_ADDRESS = 4,
}

export enum UserType {
    CUSTOMER = 1,
    ADMIN = 2,
}

export enum ImageType {
    USER_IMAGE = 1,
    PROFILE_PIC = 2
}

export enum ApplicationAction {
    ACCEPT = 1001,
    REJECT = 2001,
}

export enum Device {
    ANDROID = 1,
    IOS = 2,
    WEB = 3,
}

export enum AdminRole {
    SUPER_ADMIN = 40001,
    DISPUTE_ADMIN = 80001,
    WALLET_ADMIN = 60001,
    JOB_ADMIN = 70001,
}

export enum UserRole {
    BUSINESS = 10001,
    CUSTOMER = 40001,
    ADMIN = 80001,
}

export enum ProviderType {
    COMPANY = 1,
    INDIVIDUAL = 2,
}

// export enum Gender {
//     MALE = 1,
//     FEMALE = 2,
// }

export enum MsgType {
    TEXT = 1,
    IMAGE = 2,
    AUDIO = 3,
    VIDEO = 4,
    LOCATION = 5,
    DOCUMENT = 6,
    EVENT = 7,
    CONTACT = 8,
    VOICE = 9,
    REPLY = 10,
}

export enum convType {
    USER = 1,
    BUSINESS = 2,
    GROUP = 3
}

export enum groupEvents {
    CREATE = 1,
    ADD_MEMBER = 2,
    REMOVE_MEMBER = 3,
    JOIN_MEMBER = 4,
    NORMAL_MESSAGE = 5,
    UPDATE_GROUP = 6,
    LEAVE_GROUP = 7,
    ASSIGN_ADMIN = 8,
    REMOVE_ADMIN = 9,
    DELETE_GROUP = 10,
}

export enum UserStoryPrivacyEnum {
    MY_CONTACTS = 1,
    SHARE_ONLY_WITH = 2,
    MY_CONTACTS_EXCEPT = 3,
}

export enum ReadRecipientEnum {
    ON = 1,
    OFF = 2,
}

export enum MessageStatusEnum {
    PENDING = 0,
    SENT = 1,
    DELIVERED = 2,
    READ = 3,
    FAILED = 4,
}

export enum TermsCondition {
    YES = 1
}

// todo For Roles and Permission

export enum Permission {
    List = 1,
    Add = 2,
    Edit = 3,
    Delete = 4,
    Export = 5,
}

export enum PermissionModule {
    Users = 1,
    Category = 2,
    Sub_Admin = 3,
    Trust_Level = 4,
    Roles = 5,
    Trace_Request = 6,
}

export enum ReportType {
    USER = 0,
    BUSINESS = 1,
    EVENT = 2
}

export enum AvailableRequestStatus {
    PENDING,
    ACCEPTED,
    REJECTED,
    NONE
}

export enum ReportToType {
    COMMON = 1,
    USER = 2,
    BUSINESS = 3,
    GROUP = 4,
    POST = 5,
    SOCIAL_MEDIA = 6,
}

export enum ChatPermissionsForBusiness {
    EDIT = 1,
    FORWARD = 2,
    DELETE = 3,
}

export enum NotificationType {
    TRUST_LEVEL_UPDATE = 1,

    PERSONAL_MESSAGE = 2,
    GROUP_MESSAGE = 3,
    BUSINESS_MESSAGE = 4,

    BUSINESS_REQUEST = 5,

    SINGLE_REQUEST = 6,
    SINGLE_REQUEST_REJECT = 60,
    SINGLE_REQUEST_APPROVE = 61,


    REFERENCE_REQUEST = 7,
    REFERENCE_REQUEST_REJECT = 70,
    REFERENCE_REQUEST_APPROVE = 71,

    EMPLOYEE_REQUEST = 8,
    EMPLOYEE_REQUEST_REJECT = 80,
    EMPLOYEE_REQUEST_APPROVE = 81,

    EMPLOYEE_AVAILABILITY_REQUEST = 9,
    EMPLOYEE_AVAILABILITY_REJECT = 90,
    EMPLOYEE_AVAILABILITY_APPROVE = 91,

    PARENT_VERIFICATION_REQUEST = 10,
    PARENT_VERIFICATION_REJECT = 100,
    PARENT_VERIFICATION_APPROVE = 101,

    TRACE_USER_REQUEST = 11,
    TRACE_USER_REQUEST_REJECT = 110,
    TRACE_USER_REQUEST_APPROVE = 111,
    TRACE_END_USER_ACCESSS_LOCATION = 112,
    TRACE_END_USER_WANT_LOCATION = 113,
    REPLY_TO_USER_REPORT = 114,
}