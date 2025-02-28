import config from '../config/config.js';
import ListsSchema from './ListsSchema.js'

const createNewList = async(req, res, next) => {
    const form = req.body;
    const newList = {
        createdDate: new Date().toLocaleString(),
        updatedDate: new Date().toLocaleString(),
        userId: form.userId,
        name: form.name.trim(),
        influencersInList: []
    }
    const listCreated = await ListsSchema.create(newList);
    
    if(listCreated) {
        return res.status(200).json({
            status: true,
            message: 'List was created successfully!'
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const updateList = async(req, res, next) => {
    const form = req.body;
    const existingList = await ListsSchema.findOne({ userId: form.userId, name: form.listName });
    const influencersInList = existingList?.influencers;
    influencersInList.push(form.newInfluencer)
    
    let updatedList = await ListsSchema.findOneAndUpdate({ userId: form.userId, name: form.listName }, { $set: { influencers: influencersInList, updatedDate:  new Date().toLocaleString()}}, { new: true });
    if (updatedList) {
        return res.status(200).json({
            status: true,
            message: 'List was updated successfully!'
        });
    }

     // Update the influencers collection: Add userId to inUsersListAlready array
     await InfluencersSchema.findOneAndUpdate(
        { _id: form.influencer },
        { $addToSet: { inUsersListAlready: form.userId } } // Add userId (preventing duplicates)
    );

    // Update the influencers collection: Add userId to inUsersListAlready array
    await InfluencersSchema.findOneAndUpdate(
        { _id: form.influencer },
        { $addToSet: { hideFromUsers: form.userId } } // Add userId (preventing duplicates)
    );

    return res.status(500).json({error: 'Something went wrong'});
}

const deleteList = async(req, res, next) => {
    const form = req.query;
       console.log(req.query)
       const listToDelete = {
           userId: form.userId,
           _id: form.listId
       }
       const listDeleted = await ListsSchema.findOneAndDelete(listToDelete);
       
       if(listDeleted) {
           return res.status(200).json({
               status: true,
               message: 'List was deleted successfully!'
           });
       }
       return res.status(500).json({error: 'Something went wrong'});
}

const getMyLists = async(req, res, next) => {
    const form = req.query;
    try {
        const lists = await ListsSchema.find({userId: form.userId});

        return res.status(200).json({
            status: true,
            data: lists
        });
    } catch(error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

export { createNewList, getMyLists, deleteList, updateList };