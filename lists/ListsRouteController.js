import config from '../config/config.js';
import ListsSchema from './ListsSchema.js'
import InfluencersSchema from '../influencers/InfluencersSchema.js';

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

     // Update the influencers collection: Add userId to inUsersListAlready array
     await InfluencersSchema.findOneAndUpdate(
        { _id: form.newInfluencer._id },
        { $addToSet: { inUsersListAlready: form.userId } } // Add userId (preventing duplicates)
    );

    if (updatedList) {
        return res.status(200).json({
            status: true,
            message: 'List was updated successfully!'
        });
    } else {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const deleteList = async(req, res, next) => {
       const form = req.query;
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

const deleteInfluencerFromList = async(req, res, next) => {
    try {
    const { userId, listId, influencerId } = req.query; // Destructure query parameters

    // Update the user's list by pulling the influencer with the specified listId
    const updatedList = await ListsSchema.findOneAndUpdate(
      { _id: listId, userId: userId }, // Find document by userId
      { $pull: { influencers: { _id: influencerId } } }, // Remove influencer with matching listId from array
      { new: true } // Return the updated document
    );

    if (updatedList) {
      return res.status(200).json({
        status: true,
        message: 'Influencer was removed from the list successfully!',
        data: updatedList // Return the updated list
      });
    }

    return res.status(404).json({
      status: false,
      message: 'List or influencer not found'
    });
  } catch (error) {
    console.error('Error deleting influencer from list:', error);
    return res.status(500).json({
      status: false,
      message: 'Something went wrong'
    });
  }
}

const getMyLists = async(req, res, next) => {
    const filter = req.query;
    try {
        const lists = await ListsSchema.find({userId: filter.userId})
        .sort({createdDate: -1})
        .skip((filter && filter.page) ? parseInt(filter.limit) * (parseInt(filter.page) - 1) : 0)
        .limit(parseInt(filter.limit));

        return res.status(200).json({
            status: true,
            data: lists
        });
    } catch(error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

export { createNewList, getMyLists, deleteList, updateList, deleteInfluencerFromList };