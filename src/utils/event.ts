import {EventEmitter} from 'events';
import {io} from "../index";
import chatController from "../components/chat/chatController";
const eventEmitter = new EventEmitter();


eventEmitter.on('send_email_otp', (data: any) => {
    try {
        //remove code
        // Mail.verifyMail(data.to, data.subject, data.text_body, data.sender, data.data.otp, data.data.message,  data.data.fullName);
    } catch (error: any) {
        return console.log(error.message);      
    }
});


eventEmitter.on('send_phone_otp', (data: any) => {
    try {
        //remove code
        // Phone.sendPhoneOTP(data.to);
    } catch (error: any) {
        return console.log(error.message);      
    }
});


/**
 *  @description Register Chat User
 *  @param user's id, name, image
 * */
eventEmitter.on('registerChatUser', chatController.registerChatUser)

/**
 *  @description Update Chat User
 *  @param user's id, name, image
 * */
eventEmitter.on('updateChatUser', chatController.updateChatUser)
export default eventEmitter;