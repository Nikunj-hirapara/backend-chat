import ChatController from "./chatController";
import V from "./validation";

export default [
  {
    path: "/block",
    method: "post",
    controller: ChatController.blockUnblockUser,
    validation: null,
  },
  {
    path: "/block",
    method: "get",
    controller: ChatController.blockedUsers,
    validation: null,
  },
  {
    path: "/upload/image",
    method: "post",
    controller: ChatController.uploadImage,
    isEncrypt: false,
  },
  {
    path: "/upload/file",
    method: "post",
    controller: ChatController.uploadFile,
    isEncrypt: false,
  },
  {
    path: "/upload/video",
    method: "post",
    controller: ChatController.uploadVideo,
    isEncrypt: false,
  },
  {
    path: "/upload/audio",
    method: "post",
    controller: ChatController.uploadAudio,
    isEncrypt: false,
  },
  {
    path: "/group",
    method: "post",
    controller: ChatController.createGroup,
  },
  {
    path: "/group/:groupid",
    method: "put",
    controller: ChatController.updateGroup,
  },
  {
    path: "/group/:groupid",
    method: "delete",
    controller: ChatController.deleteGroup,
    isEncrypt: false,
  },
  {
    path: "/group/:groupid/members",
    method: "delete",
    controller: ChatController.leaveGroup,
    isEncrypt: false,
  },
  {
    path: "/group/:groupid/members/",
    method: "get",
    controller: ChatController.groupMembers,
    isEncrypt: false,
  },
  {
    path: "/group/:groupid/members/:userid",
    method: "put",
    controller: ChatController.addMember,
    // validation: [V.addMemberValidation],
    isEncrypt: false,
  },
  {
    path: "/group/:groupid/members/:userid",
    method: "delete",
    controller: ChatController.removeMember,
    // validation: [V.addMemberValidation],
    isEncrypt: false,
  },
  {
    path: "/group/:groupid/admin/:userid",
    method: "put",
    controller: ChatController.addGroupAdmin,
    // validation: [V.addMemberValidation],
    isEncrypt: false,
  },
  {
    path: "/group/:groupid/admin/:userid",
    method: "delete",
    controller: ChatController.removeGroupAdmin,
    // validation: [V.addMemberValidation],
    isEncrypt: false,
  },
];
