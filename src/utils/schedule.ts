import {Agenda} from 'agenda';
const config = require("config");

const agenda = new Agenda({db: {address: config.get("DB_CONN_STRING"), collection: 'verifyLocationSchedule'}});
const User = require("../components/users/models/userModel")
agenda.define('activeUser', async (job: any) => {
        const {user_id} = job.attrs.data;
        const userInactive = await User.findOne({_id: user_id});
        userInactive.status = 1
        userInactive.endDate = null
        userInactive.save();
    }
);

/**
 *  Change Event Status For Active events
 * */
agenda.define("updateEventStatus", async (args: any) => {

})

export default agenda;