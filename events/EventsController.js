import UserSchema from '../users/UserSchema.js';
import EventsSchema from './EventsSchema.js';

const myEvents = async(req, res, next) => {
    const form = req.query;
    console.log(form)
    try {
        const events = await EventsSchema.find({userId: form.userId});
    
        return res.status(200).json({
            status: true,
            data: events
        });
    } catch(error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const updateEvent = async(req, res, next) => {
     const form = req.body;

    const updatedEvent = await EventsSchema.findOneAndUpdate({ userId: form.userId, _id: form._id },
        { $set: form },
        { new: true }
    )

    if (updatedEvent) {
        return res.status(200).json({
            status: true,
            message: 'Event was updated successfully!',
            data: updatedEvent
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const deleteEvent = async(req, res, next) => {
     const form = req.query;
        console.log(req.query)
        const eventToDelete = {
            userId: form.userId,
            _id: form.eventId
        }
        const eventDeleted = await EventsSchema.findOneAndDelete(eventToDelete);
        
        if(eventDeleted) {
            return res.status(200).json({
                status: true,
                message: 'Event was deleted successfully!'
            });
        }
        return res.status(500).json({error: 'Something went wrong'});
      
}

const createEvent = async(req, res, next) => {
    const form = req.body;
    console.log(form)
        const newEvent = {
            createdDate: new Date().toLocaleString(),
            userId: form.userId,
            name: form.name,
            startDate: form.startDate,
            startTime: form.startTime,
            endate: form.endDate,
            endTime: form.endTime,
            isEndDate: form.endDate ? true : false
        }
        const eventCreated = await EventsSchema.create(newEvent);
        
        if(eventCreated) {
            return res.status(200).json({
                status: true,
                message: 'Event was created successfully!'
            });
        }
        return res.status(500).json({error: 'Something went wrong'});
}

export { myEvents, updateEvent, deleteEvent, createEvent };