import notificationController from "./notificationController";

// path: "", method: "post", controller: "",
// validation: ""(can be array of validation),
// isEncrypt: boolean (default true), isPublic: boolean (default false)

export default [
    {
        path: "/",
        method: "get",
        controller: notificationController.notificationList,
    },
    {
        path: "/count",
        method: "get",
        controller: notificationController.typeWiseCount,
    },
    {
        path: "/read/:id", //pass 'all' for all read notify
        method: "put",
        controller: notificationController.readNotification,
        isEncrypt:false
    },
];
