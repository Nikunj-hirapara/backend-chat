import { AppStrings } from "../../../utils/appStrings";


const Admin = require("../models/admin");
const User = require("../../users/models/userModel");
const Role = require("../models/role");
import { Request, Response } from "express";
import commonUtils, { fileFilter, fileStorage } from "../../../utils/commonUtils";
import Auth from "../../../auth";
import { AdminRole } from "../../../utils/enum";
import mongoose from "mongoose";

const bcrypt = require("bcryptjs");
const multer = require("multer");

async function adminRegister(req: Request, res: Response) {
    const admin = new Admin({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        adminrole: req.body.adminrole,
        about: req.body.about,
        mobile: req.body.mobile,
        image: req.body.image_url,
        isActive: true
    });

    if (parseInt(req.body.adminrole) === AdminRole.SUPER_ADMIN) {
        const CheckSuperAdmin = await Admin.findOne({ adminrole: AdminRole.SUPER_ADMIN }).exec();
        if (CheckSuperAdmin) {
            return commonUtils.sendAdminError(req, res, { message: AppStrings.SUPER_ADMIN_ALREADY_EXISTS }, 409);
        }
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(admin.password, salt);

    await admin.save();
    return commonUtils.sendAdminSuccess(req, res, { message: "Admin Register successfully", id: admin._id });
}

async function adminUpdate(req: Request, res: Response) {
    const adminId = req.body.admin_id
    const admin = await Admin.findById(adminId)
    if (!admin) return commonUtils.sendAdminError(req, res, { message: "admin not found" }, 409)

    admin.username = req.body.username || admin.username;
    admin.email = req.body.email || admin.email;
    admin.adminrole = req.body.adminrole || admin.adminrole;
    admin.isActive = req.body.isActive || admin.isActive;
    admin.mobile = req.body.mobile || admin.mobile;
    admin.about = req.body.about || admin.about;

    await admin.save()
    return commonUtils.sendAdminSuccess(req, res, { message: "Admin Updated successfully", id: admin._id })
}

async function login(req: Request, res: Response) {
    const email = req.body.email;
    const password = req.body.password;
    const device = req.body.device ?? 3;

    if (!email)
        return commonUtils.sendAdminError(req, res, { message: AppStrings.EMAIL_REQUIRED }, 400);

    const admin = await Admin.findOne({ email: email, isActive: false }).lean();
    if (admin)
        return commonUtils.sendAdminError(req, res, { message: "your account is inactive." }, 400);

    try {
        let find_filed;
        let message;
        if (email) {
            find_filed = { email: email };
            message = AppStrings.EMAIL_NOT_EXISTS;
        }

        const admin = await Admin.findOne(find_filed).lean();
        if (!admin)
            return commonUtils.sendAdminError(req, res, { message: message }, 409);

        const role = await Role.findOne({ _id: admin.adminrole })

        const valid_password = await bcrypt.compare(password, admin.password);
        if (!valid_password) {
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');
            return commonUtils.sendAdminError(req, res, { message: AppStrings.INVALID_PASSWORD }, 409);
        }
        const { refreshToken, accessToken } = await Auth.login(admin._id, admin.adminrole, admin.createdAt, device);
        await Admin.findByIdAndUpdate(admin._id, { $set: { lastLogin: new Date() } }).exec();
        res.cookie("accessToken", accessToken, { maxAge: 900000, httpOnly: true });
        res.cookie("refreshToken", refreshToken, { maxAge: 900000, httpOnly: true });

        const responseObj = {
            role: admin.adminrole,
            permission: role.permission,
            accessToken: accessToken,
            user: {
                displayName: admin.username,
                id: admin._id,
                photoURL: admin.image ?? null
            },
        }

        return commonUtils.sendAdminSuccess(req, res, responseObj);

    } catch (error) {
        return commonUtils.sendAdminError(req, res, { error: error }, 409);
    }
}
async function adminDelete(req: Request, res: Response) {
    const adminId = req.params.id

    await Admin.deleteOne({ _id: new mongoose.Types.ObjectId(adminId) })

    return commonUtils.sendAdminSuccess(req, res, { message: AppStrings.ADMIN_DELETE })

}

async function loginAccess(req: Request, res: Response) {
    const admin_id = req.body.admin_id;
    const admin = await Admin.findOne({ _id: admin_id });
    const device = parseInt(req.headers.device as string) || 3;

    if (!admin)
        return commonUtils.sendAdminError(req, res, { message: AppStrings.ADMINID_INVALID }, 409);

    if (!admin.isActive)
        return commonUtils.sendAdminError(req, res, { message: AppStrings.NOT_ACTIVE }, 401);

    const { refreshToken, accessToken } = await Auth.login(admin._id, admin.adminrole, admin.createdAt, device);
    await Admin.findByIdAndUpdate(admin._id, { $set: { lastLogin: new Date() } }).exec();

    res.cookie("accessToken", accessToken, { maxAge: 900000, httpOnly: true });
    res.cookie("refreshToken", refreshToken, { maxAge: 900000, httpOnly: true });

    res.cookie("refreshToken", refreshToken, { httpOnly: false, secure: true, maxAge: 24 * 60 * 60 * 1000 });

    const responseObj = {
        role: admin.adminrole,
        accessToken: accessToken,
        user: {
            displayName: admin.username,
            id: admin._id,
            photoURL: admin.image ?? null
        },
    }

    return commonUtils.sendAdminSuccess(req, res, responseObj);
}

const getProfile = async (req: any, res: Response) => {
    const adminId = req.headers.userid;
    const pipline = [
        {
            $match: {
                _id: new mongoose.Types.ObjectId(adminId)
            }
        },
        {
            $lookup: {
                from: 'roles',
                localField: 'adminrole',
                foreignField: '_id',
                as: 'roleData'
            }
        },
        { $unwind: { path: "$roleData", preserveNullAndEmptyArrays: true } },
        {
            $project: {
                "_id": 0,
                "id": "$_id",
                "name": "$username",
                "email": "$email",
                "image": "$image",
                "mobile": "$mobile",
                "about": "$about",
                // "roleCode": "$adminrole",
                "adminrole": {
                    "id": "$roleData._id",
                    "name": "$roleData.name",
                },
                "status": { $cond: { if: "$isActive", then: "Active", else: "Deactive" } }
            }
        }
    ]
    const admin = await Admin.aggregate(pipline);
    return commonUtils.sendAdminSuccess(req, res, admin.length ? admin[0] : {});
}

const assignRole = async (req: any, res: Response) => {
    const admin_id = req.body.id;
    const updateData = {
        adminrole: req.body.adminRole,
        isActive: req.body.isActive
    }
    const data = await Admin.findByIdAndUpdate(admin_id, updateData)
    return commonUtils.sendAdminSuccess(req, res, data, 200);
}

async function checkUnique(req: any, res: Response) {
    return commonUtils.sendAdminSuccess(req, res, {});
}

async function methodAllowance(req: any, res: Response) {
    return commonUtils.sendAdminError(
        req,
        res,
        { message: "Request method now allowed." },
        405
    );
}

const uploadImage = async (req: Request, res: Response) => {
    const image_ = multer({
        storage: fileStorage,
        fileFilter: fileFilter,
    }).single("image");

    image_(req, res, async (err: any) => {
        if (err) return commonUtils.sendError(req, res, { message: AppStrings.IMAGE_NOT_UPLOADED }, 409);
        if (!req.file) return commonUtils.sendError(req, res, { message: AppStrings.IMAGE_NOT_FOUND }, 409);
        const image_name = req.file.filename;
        return commonUtils.sendAdminSuccess(req, res, {
            image_url: image_name,
            message: AppStrings.IMAGE_UPLOADED
        });
    });
}

// admin listing not include admminrole=2
async function adminList(req: Request, res: Response) {
    const search = req.query.search;
    let filter: any = {};
    if (search) {
        filter = {
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { "roleData.name": { $regex: search, $options: "i" } },
            ]
        };
    }

    const pipline = [
        {
            $lookup: {
                from: 'roles',
                localField: 'adminrole',
                foreignField: '_id',
                as: 'roleData'
            }
        },
        { $unwind: { path: "$roleData", preserveNullAndEmptyArrays: true } },
        { $match: filter },
        {
            $project: {
                "name": "$username",
                "id": "$_id",
                "email": "$email",
                "image": "$image",
                "mobile": "$mobile",
                "about": "$about",
                // "roleCode": "$adminrole",
                "adminrole": {
                    "id": "$roleData._id",
                    "name": "$roleData.name",
                },
                "status": { $cond: { if: "$isActive", then: "Active", else: "Deactive" } }
            }
        }
    ]
    const adminList = await Admin.aggregate(pipline);

    return commonUtils.sendAdminSuccess(req, res, adminList);
}

async function changePassword(req: any, res: Response) {
    const userId = req.headers.userid;
    const adminRole = req.headers.adminrole;
    const adminId = req.body.admin_id;
    const old_password = req.body.old_password;
    const new_password = req.body.new_password;

    const admin = await Admin.findById(adminId).exec();
    if (!admin) return commonUtils.sendAdminError(req, res, { errors: { message: AppStrings.ADMIN_NOT_FOUND } }, 409);

    const valid_password = await bcrypt.compare(old_password, admin.password);
    if (!valid_password) return commonUtils.sendAdminError(req, res, { errors: { message: AppStrings.INVALID_PASSWORD } }, 409);

    if (adminRole !== AdminRole.SUPER_ADMIN && userId !== adminId) {
        return commonUtils.sendAdminError(req, res, { errors: { message: AppStrings.NOT_AUTHORIZED } }, 409);
    }
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(new_password, salt);
    await admin.save();

    return commonUtils.sendAdminSuccess(req, res, { message: AppStrings.PASSWORD_CHANGED }, 200);
}

export default {
    adminRegister,
    adminUpdate,
    adminDelete,
    login,
    getProfile,
    assignRole,
    checkUnique,
    methodAllowance,
    loginAccess,
    adminList,
    uploadImage,
    changePassword
};