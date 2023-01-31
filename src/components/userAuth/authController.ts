import {AppStrings} from "../../utils/appStrings";
import {Request, Response} from "express";
import commonUtils from "../../utils/commonUtils";
import {Device, UserData, UserType} from "../../utils/enum";
import mongoose, {ObjectId} from "mongoose";
import Auth from "../../auth";
import crypto from "crypto";
import eventEmitter from "../../utils/event";

const User = require('../users/models/userModel');
const Token = require("./tokenModel");

const bcrypt = require("bcryptjs");
const config = require("config");

const { getAuth } = require('firebase-admin/auth');

async function register(req: Request, res: Response) {

    const user = new User({
        fullName: req.body.fullName,
        email: req.body.userName?.[UserData.EMAIL.toString()],
        mobile: req.body.userName?.[UserData.MOBILE.toString()],
        password: req.body.password,
        pushToken: req.body.pushToken,
        device: req.body.device,
        permissions: {
            chatPermission: {
                public: true,
                contact: true,
                marketing: true
            },
            visibility: {
                picture: true,
                status: true,
                post: true
            },
            locationPermission: {
                whileUsingApp: false,
                withLinkedContact: false,
                withPublic: true,
                notShared: false,
            },
        }
    });

    if (!user.email && !user.mobile)
        return commonUtils.sendError(req, res, {errors: {"userName": AppStrings.EMAIL_MOBILE_REQUIRED}}, 400);
    // hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    await user.save();

    eventEmitter.emit("registerChatUser", {
        "userId": user._id,
        "name": user.userName ?? "",
        "image": user.image?.profilePic ?? "",
    })


    if (user.email) {
        await sendVerifyOTP(user._id, user.email, user.device, 'email', 'forSignUp', 'please verify your email' , null, null, user.fullName)

        // this event is no longer required.
        // eventEmitter.emit('user.checkForSelfEndorsed', {userId: user._id, email: user.email})
        return commonUtils.sendSuccess(req, res, {message: AppStrings.CHECK_MAIL})
    } else if (user.mobile) {
        // await sendVerifyOTP(user._id, user.mobile, user.device, 'mobile', 'forSignUp', 'please verify your mobile', null, null, user.fullName)
        // this event is no longer required.
        // eventEmitter.emit('user.checkForSelfEndorsed', {userId: user._id, mobile: user.mobile})
        return commonUtils.sendSuccess(req, res, {message: AppStrings.CHECK_PHONE})
    } else {
        return commonUtils.sendError(req, res, {message: AppStrings.USER_CREDENTIAL_DOES_NOT_MATCH})
    }
}

async function login(req: Request, res: Response) {
    const email = req.body.userName[UserData.EMAIL.toString()];
    const mobile = req.body.userName[UserData.MOBILE.toString()];
    const password = req.body.password;
    const device = req.body.device ?? 3;
    const terminateSession = req.body.terminateSession || false;

    if (!email && !mobile) return commonUtils.sendError(req, res, {message: AppStrings.EMAIL_MOBILE_REQUIRED}, 400);

    const find_filed = email ? {email: email} : {mobile: mobile};

    try {
        const user = await User.findOne(find_filed);     

        if (user.isDeleted == 1) {
            const responseObj = {
                user: {
                    displayName: user.fullName,
                    userName: user.userName,
                    _id: user._id,
                    email: user.email,
                    mobile: user.mobile,
                    profilePic: user.image.profilePic ?? null,
                    isDeleted: user.isDeleted, 
                    status: user.status
                },
    
            }
            return commonUtils.sendSuccess(req, res, responseObj)
        }

        if (!user) return commonUtils.sendError(req, res, {message: AppStrings.USER_CREDENTIAL_DOES_NOT_MATCH}, 409);

        const valid_password = await bcrypt.compare(password, user.password);
        if (!valid_password) {
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');
            return commonUtils.sendError(req, res, {message: AppStrings.INVALID_PASSWORD}, 409);
        }

        if (!user.isVerify || parseInt(user.isVerify) === 0) {
            if (email) {
                await sendVerifyOTP(user._id, email, user.device, 'email', 'forSignUp', 'Your email has been verified', null, null, user.fullName)
                return commonUtils.sendSuccess(req, res, {isVerify: 0})
            }
        }

        if (device !== Device.WEB && !terminateSession) {
            const [noPreviousToken, errOnPreviousToken] = await Auth.checkSession(user._id, UserType.CUSTOMER, user.createdAt, device);
            if (errOnPreviousToken) {
                return commonUtils.sendSuccess(req, res, {message: errOnPreviousToken, session: !!errOnPreviousToken});
            }
        }

        const response_ = await Auth.login(user._id, UserType.CUSTOMER, user.createdAt, device);
        if (req.body?.pushToken) {
            await User.findByIdAndUpdate(user._id, {$set: {pushToken: req.body.pushToken}})
        }
        await User.findByIdAndUpdate(user._id, {$set: {lastLogin: new Date()}}).exec();

        res.cookie("accessToken", response_.accessToken, {maxAge: 900000, httpOnly: true});
        res.cookie("refreshToken", response_.refreshToken, {maxAge: 900000, httpOnly: true});

        eventEmitter.emit("updateChatUser", {
            "userId": user._id,
            "name": user.fullName ?? "",
            "image": user.image?.profilePic ?? "",
        })

        const responseObj = {
            usertype: user.usertype,
            isProfileComplete: user.isProfileComplete,
            accessToken: response_.accessToken,
            isVerify: user.isVerify,
            user: {
                displayName: user.fullName,
                userName: user.userName,
                _id: user._id,
                email: user.email,
                mobile: user.mobile,
                profilePic: user.image.profilePic ?? null,
                status: user.status,
             
            },
        }

        return commonUtils.sendSuccess(req, res, responseObj);
    } catch (error: any) {
        console.log(error.message);
        return commonUtils.sendError(req, res, {error: AppStrings.SOMETHING_WENT_WRONG});
    }
}


async function guestLogin(req: Request, res: Response) {
    try {
        const deviceId = req.body.deviceId;
        if (!deviceId) return commonUtils.sendError(req, res, AppStrings.INVALID_DEVICEID)
        const device = req.body.device ?? 3;

        const response_ = await Auth.login(deviceId, UserType.CUSTOMER, new Date().toISOString(), device, true);
        res.cookie("accessToken", response_.accessToken, {maxAge: 900000, httpOnly: true});
        res.cookie("refreshToken", response_.refreshToken, {maxAge: 900000, httpOnly: true});

        const responseObj = {
            usertype: UserType.CUSTOMER,
            isProfileComplete: false,
            accessToken: response_.accessToken,
            isVerify: 0,
            isGuest: 1,
        }

        return commonUtils.sendSuccess(req, res, responseObj);
    } catch (error: any) {
        console.log(error.message);
        return commonUtils.sendError(req, res, {error: AppStrings.SOMETHING_WENT_WRONG});
    }
}

async function sendVerifyOTP(userId: ObjectId, credential: any, device: any, median: string, reason: any, subject: string, businessId = "", choice = 0, fullName: any): Promise<number> {

    try {
        const otp = Number((Math.random() * (999999 - 100000) + 100000).toFixed()); //TODO: logic wise generate
        // console.log(otp);
        
        // if (median === 'mobile') {
        //     // comment for now
        //     eventEmitter.emit("send_phone_otp", {to: credential});
        // } else
         if (median === 'email') {
            eventEmitter.emit("send_email_otp", {
                to: credential,
                subject: subject,
                data: {
                    otp: otp,
                    message: "Your email has been verified",
                    fullName: fullName
                },
            });
        } else {
            return 0
        }

        let resetToken = crypto.randomBytes(64).toString("hex");
        resetToken = await genrateUniqueToken(resetToken);
        const hash_ = await bcrypt.hash(resetToken, Number(config.get("saltRounds")));

        await Token.deleteOne({userId});

        if (businessId == "") businessId = null

        const tokenData = new Token({
            userId: userId,
            businessId: businessId,
            otp: otp,
            token: hash_,
            choice: choice,
            device: device,
            forSignUp: reason === 'forSignUp'
        });

        await tokenData.save();

        return otp;
    } catch (error: any) {
        console.log(error.message);
    }
}

async function methodAllowance(req: any, res: Response) {
    return commonUtils.sendError(req, res, {message: "Request method now allowed."}, 405);
}

async function forgotPassword(req: any, res: Response) {
    const token = req.body.token;
    
    const password = req.body.password;

    const device = req.body.device;


    const token_ = await Token.findOne({token: token, device: device, isVerified: true}).exec();

    if (!token_) return commonUtils.sendError(req, res, {message: AppStrings.INVALID_TOKEN}, 409);

    const user = await User.findById(token_.userId).exec();
    if (!user) return commonUtils.sendError(req, res, {message: AppStrings.USER_NOT_FOUND}, 409);

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.updateOne({password: user.password}).exec();

    await Token.deleteOne({token: token}).exec();

    // TODO blackList old tokens

    return commonUtils.sendSuccess(req, res, {message: AppStrings.PASSWORD_CHANGED,}, 200);
}

async function changePassword(req: any, res: Response) {
    const user_id = req.headers.userid;
    const old_password = req.body.old_password;
    const new_password = req.body.new_password;

    const user = await User.findById(user_id).exec();
    if (!user)
        return commonUtils.sendError(req, res, {message: AppStrings.USER_NOT_FOUND}, 409);

    const valid_password = await bcrypt.compare(old_password, user.password);
    if (!valid_password)
        return commonUtils.sendError(req, res, {message: AppStrings.INVALID_PASSWORD}, 409);

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(new_password, salt);
    await user.updateOne({password: user.password}).exec();

    // TODO blackList old tokens

    return commonUtils.sendSuccess(req, res, {message: AppStrings.PASSWORD_CHANGED,}, 200);
}

async function getOTP(req: Request, res: Response) {
    const email = req.body.userName?.[UserData.EMAIL.toString()];
    const mobile = req.body.userName?.[UserData.MOBILE.toString()];
    const device = req.body.device;

    if (!email && !mobile) return commonUtils.sendError(req, res, {message: AppStrings.EMAIL_MOBILE_REQUIRED}, 400);

    let find_filed;
    if (email) {
        find_filed = {email: email};
    } else {
        find_filed = {mobile: mobile};
    }

    const user = await User.findOne(find_filed).exec();

    if (!user) return commonUtils.sendError(req, res, {message: AppStrings.USER_CREDENTIAL_DOES_NOT_MATCH}, 409);

    if (email) {
        await sendVerifyOTP(user._id, user.email,  device, 'email', 'forForgotPassword', 'Your otp has been verified', null, null, user.fullName)
        return commonUtils.sendSuccess(req, res, {message: AppStrings.CHECK_MAIL})
    // } else if (mobile) {
    //     await sendVerifyOTP(user._id, user.mobile, device, 'mobile', 'forForgotPassword', 'Your Otp has been verified', null, null, user.fullName)
    //     return commonUtils.sendSuccess(req, res, {message: AppStrings.CHECK_PHONE})
    } else {
        return commonUtils.sendError(req, res, {message: AppStrings.USER_CREDENTIAL_DOES_NOT_MATCH})
    }
}

async function resendOTP(req: Request, res: Response) {
    const email = req.body.userName?.[UserData.EMAIL.toString()];
    const mobile = req.body.userName?.[UserData.MOBILE.toString()];
    const device = req.body.device;
    const reason = req.body.reason;

    if (!['forSignUp', 'forForgotPassword'].includes(reason)) {
        return commonUtils.sendError(req, res, {message: AppStrings.INVALID_REASON})
    }

    if (!email && !mobile) return commonUtils.sendError(req, res, {message: AppStrings.EMAIL_MOBILE_REQUIRED}, 400);

    let find_filed;
    if (email) {
        find_filed = {email: email};
    } else {
        find_filed = {mobile: mobile};
    }

    const user = await User.findOne(find_filed).exec();
    if (!user) return commonUtils.sendError(req, res, {message: AppStrings.USER_CREDENTIAL_DOES_NOT_MATCH}, 409);

    if (user.email) {
        await sendVerifyOTP(user._id, user.email, device, 'email', reason, 'Your otp has been verified', null, null, user.fullName)
        return commonUtils.sendSuccess(req, res, {message: AppStrings.CHECK_MAIL})
    // } else if (user.mobile) {
    //     await sendVerifyOTP(user._id, user.mobile, device, 'mobile', reason, 'Your Otp has been verified', null, null, user.fullName)
    //     return commonUtils.sendSuccess(req, res, {message: AppStrings.CHECK_PHONE})
    } else {
        return commonUtils.sendError(req, res, {message: AppStrings.USER_CREDENTIAL_DOES_NOT_MATCH})
    }

}

async function genrateUniqueToken(token_: string) {
    let token = token_;
    let count = 0;
    while (true) {
        const token_ = await Token.findOne({token: token});
        if (!token_) break;
        count += 1;
        token = token_ + count;
    }
    return token;
}

async function verifyOTP(req: Request, res: Response) {
    const otp = req.body.otp;
    const device = req.body.device;
    const email = req.body.userName?.[UserData.EMAIL.toString()];
    const mobile = req.body.userName?.[UserData.MOBILE.toString()];

    if (!email && !mobile) return commonUtils.sendError(req, res, {message: AppStrings.EMAIL_MOBILE_REQUIRED}, 400);

    let find_filed;
    if (email) {
        find_filed = {email: email};
    } else {
        find_filed = {mobile: mobile};
    }

    const user = await User.findOne(find_filed).exec();
    if (!user) return commonUtils.sendError(req, res, {message: AppStrings.USER_CREDENTIAL_DOES_NOT_MATCH}, 409);

    if (mobile) {
        // comment for now 
        // const [success, err] = [otp === "1111", false]
        
    } else {
        const token = await Token.findOne({
            userId: new mongoose.Types.ObjectId(user._id),            
            device: device,
            forSignUp: false
        });
        if (!token) return commonUtils.sendError(req, res, {message: AppStrings.INCORRECT_OTP}, 400);

        // increase request count
        token.requestCount += 1;
        await token.updateOne({requestCount: token.requestCount});

        // check if otp is valid
        if (token.requestCount > 3) return commonUtils.sendError(req, res, {message: AppStrings.OTP_REQUEST_LIMIT}, 400);
        if (token.isVerified) return commonUtils.sendError(req, res, {message: AppStrings.OTP_ALREADY_VERIFIED}, 400);
        if (token.otp !== otp) return commonUtils.sendError(req, res, {message: AppStrings.INVALID_OTP}, 400);

        token.isVerified = true;
        await token.save();

        return commonUtils.sendSuccess(req, res, {token: token.token}, 200);
    }

}

// send email to user verify singup 
async function signupVerifyOTP(req: Request, res: Response) {
    const otp = req.body.otp;
    const device = req.body.device;
    const email = req.body.userName?.[UserData.EMAIL.toString()];
    const mobile = req.body.userName?.[UserData.MOBILE.toString()];

    if (!email && !mobile) return commonUtils.sendError(req, res, {message: AppStrings.EMAIL_MOBILE_REQUIRED}, 400);

    let find_filed;
    if (email) {
        find_filed = {email: email};
    } else {
        find_filed = {mobile: mobile};
    }

    const user = await User.findOne(find_filed).exec();
    if (!user) return commonUtils.sendError(req, res, {message: AppStrings.USER_CREDENTIAL_DOES_NOT_MATCH}, 409);

    if (email) {
        if (user.isVerify) return commonUtils.sendError(req, res, {message: AppStrings.OTP_ALREADY_VERIFIED})
    }

    if (email) {
        // comment for now
        // const [success, err] = [otp === "1111", false]
        // const [success, err] = await Phone.verifyPhoneOtp(mobile, otp)
        // console.log(success);

        // if (err) {
        //     return commonUtils.sendError(req, res, {message: AppStrings.INCORRECT_OTP}, 409);
        //     // return commonUtils.sendError(req, res, {message: err === "Authenticate" ? AppStrings.INCORRECT_OTP : err}, 409);
        // }
        // if (success) {
        //     user.isVerify = 1;
        //     await user.save();
        //     await Token.findOneAndUpdate({
        //         userId: new mongoose.Types.ObjectId(user._id),
        //         device: device,
        //         forSignUp: true
        //     }, {$set: {isVerified: true}})
        // }
        const token = await Token.findOne({userId: user._id,device: device,forSignUp: true});
        if (!token) return commonUtils.sendError(req, res, {message: AppStrings.INCORRECT_OTP}, 400);
        // increase request count
        token.requestCount += 1;
        await token.updateOne({requestCount: token.requestCount});
    
        // check if otp is valid
        if (token.requestCount > 3) return commonUtils.sendError(req, res, {message: AppStrings.OTP_REQUEST_LIMIT}, 400);
        if (token.isVerified) return commonUtils.sendError(req, res, {message: AppStrings.OTP_ALREADY_VERIFIED}, 400);
        if (token.otp != otp) return commonUtils.sendError(req, res, {message: AppStrings.INVALID_OTP}, 400);
    
        token.isVerified = true;
        await token.updateOne({isVerified: token.isVerified});
    
        user.isVerify = 1;
        await user.save()
    } 
   
    const response_ = await Auth.login(user._id, UserType.CUSTOMER, user.createdAt, device);

    res.cookie("accessToken", response_.accessToken, {maxAge: 900000, httpOnly: true});
    res.cookie("refreshToken", response_.refreshToken, {maxAge: 900000, httpOnly: true});

    const responseObj = {
        isProfileComplete: user.isProfileComplete,
        usertype: user.usertype,
        isVerify: user.isVerify,
        accessToken: response_.accessToken,
        user: {
            displayName: user.fullName,
            userName: user.userName,
            _id: user._id,
            email: user.email,
            mobile: user.mobile,
            profilePic: user.image.profilePic ?? null
        },
    }
    return commonUtils.sendSuccess(req, res, responseObj);
}

async function checkUnique(req: any, res: Response) {
    return commonUtils.sendSuccess(req, res, {});
}

export default {
    register,
    login,
    guestLogin,
    methodAllowance,
    forgotPassword,
    changePassword,
    getOTP,
    verifyOTP,
    signupVerifyOTP,
    resendOTP,
    sendVerifyOTP
};