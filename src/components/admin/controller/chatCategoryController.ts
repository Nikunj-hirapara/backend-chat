import { AppStrings } from "../../../utils/appStrings";
const ChatCategory = require("../models/chatCategory");
const Category = require("../models/category");
import { NextFunction, query, Request, Response } from "express";
import commonUtils, { fileFilter, fileStorage } from "../../../utils/commonUtils";
import mongoose from "mongoose";

async function chatCategory(req: Request, res: Response) {

    try {
        const {
            name,
            parentId,
        } = req.body

        let chatCategoryCheck = await ChatCategory.findOne({ name: name, parentId: new mongoose.Types.ObjectId(parentId) });

        if (chatCategoryCheck) {
            return commonUtils.sendError(req, res, { message: AppStrings.NAME_ALREADY_EXIST }, 409);
        }

        let category = await Category.findOne({ _id: new mongoose.Types.ObjectId(parentId), parentId: { $exists: 1 } })

        if (!category)
            return commonUtils.sendError(req, res, { message: AppStrings.CATEGORY_NOT_FOUND })

        var chatCategory = new ChatCategory({
            name,
            parentId
        })
        await chatCategory.save()

        return commonUtils.sendAdminSuccess(req, res, chatCategory);
    } catch (error) {
        return commonUtils.sendAdminError(req, res, { error: AppStrings.SOMETHING_WENT_WRONG });
    }
}

async function getSubCategory(req: Request, res: Response) {
    var data = await Category.find({
        parentId: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 }).select('_id name parentId');

    return commonUtils.sendAdminSuccess(req, res, data);
}

async function getCategory(req: Request, res: Response) {

    try {
        const search = req.query.search
        const page = parseInt(req.query.page as string) || 1;
        const limit_ = parseInt(req.query.limit as string) || 10;
        const skip_ = (page - 1) * limit_;
        var a: any = null

        let fillter = {
            'parentId': {
                $ne: a
            },
        }

        let pipeline = [
            {
                $match: fillter
            },
            {
                $lookup: {
                    from: 'chatcategories',
                    localField: '_id',
                    foreignField: 'parentId',
                    as: 'child'
                }
            },
            {
                $project: {
                    _id: 1,
                    name: "$name",
                    // subCategory: "$Data",
                    "child._id": 1,
                    "child.name": 1
                }

            }
        ]

        let category = await Category.aggregate(pipeline)

        if (category.length && search) {
            category = category.filter((i: any) => {
                return i?.name.toLowerCase().includes(search) || i.child.map((j: any) => j.name.toLowerCase().includes(search)).includes(true)
            })
        }

        var total = await Category.find({
            parentId: { $exists: true, $ne: null },
        }).countDocuments();
        const hasMoreData = total > skip_ + limit_;

        const metaData = {
            page: page,
            limit: limit_,
            total: total,
            hasMoreData: hasMoreData,
        };

        return commonUtils.sendAdminSuccess(req, res, [{ metadata: [metaData], data: category.slice(skip_, skip_ + limit_) }]);
    } catch (error) {
        console.log(error);

        return commonUtils.sendAdminError(req, res, { error: AppStrings.SOMETHING_WENT_WRONG });
    }
}

async function deleteSubCategory(req: Request, res: Response) {
    let categoryId = req.params.id;

    let cat = await ChatCategory.findById(categoryId)

    if (!cat)
        return commonUtils.sendError(req, res, { message: AppStrings.CATEGORY_NOT_FOUND })

    await ChatCategory.findByIdAndDelete(categoryId)

    return commonUtils.sendAdminSuccess(req, res, { message: AppStrings.DELETE });
}

export default {
    chatCategory,
    getCategory,
    getSubCategory,
    deleteSubCategory
}