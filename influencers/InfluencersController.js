import config from '../config/config.js';
import ListsSchema from '../lists/ListsSchema.js'
import InfluencersSchema from '../influencers/InfluencersSchema.js';

const fetchAllInfluencers = async(req, res, next) => {
    const sorting = { 'firstName': -1 };
    const filter = req.query;
    const query = { $and: [] }; // Initialize $and operator as an array


    if(filter.platform) {
        //query.$and.push({ platform: filter.platform }); UNCOMMENT LATER ONCE INFLUENCERS IN DB HAVE THIS FIELD ADDED
    }
    if(filter.followers) {
        const [min, max] = filter.followers.split(" - ").map(num => Number(num.replace(/,/g, "")));
        query.$and.push({ followersIGNum: { $gte: parseInt(min) } });
        query.$and.push({ followersIGNum: { $lte: parseInt(max) } });
    }
    if(filter.category) {
        query.$and.push({ category: filter.category });
    }
    if(filter.keywordSearch) {
        query.$and.push({ name: { $regex: filter.keywordSearch, $options: 'i' } }); // Case-insensitive keyword search
    }
    
    if(filter.excludesInfluencersInLists === 'true' || filter.excludesInfluencersInLists === true) {
        query.$and.push({ inUsersListAlready: { $nin: filter.userId } }); // Exclude specific lists
    }

    if(filter.excludeHiddenInfluencers === 'true' || filter.excludeHiddenInfluencers === true) {
        query.$and.push({ hideFromUsers: { $nin: filter.userId } });
    }

    // If no conditions are added, remove $and to avoid empty queries
    if (query.$and.length === 0) {
        delete query.$and;
    }
    
    try {
        const influencers = await InfluencersSchema.find(query)
        //.sort(sorting)
        .skip((filter && filter.page) ? parseInt(filter.limit) * (parseInt(filter.page) - 1) : 0)
        .limit(parseInt(filter.limit));
    
        if(influencers?.length) {
            return res.status(200).json({
                status: true,
                data: influencers
            });
        } 

        return res.status(200).json({
            status: true,
            data: []
        });
    } catch(error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const unhideInfluencer = async(req, res, next) => {
    const filter = req.body;
    try {
        const influencerUpdated = await InfluencersSchema.findOneAndUpdate(
            { _id: filter._id }, 
            { $pull: { hideFromUsers: filter.userId } }, 
            { new: true }
        );

        if(influencerUpdated?.length) {
            return res.status(200).json({
                status: true,
                data: influencerUpdated
            });
        } 

        return res.status(200).json({
            status: true,
            data: []
        });
    } catch (error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const hideInfluencer = async(req, res, next) => {
    const filter = req.body;
    try {
        const influencerUpdated = await InfluencersSchema.findOneAndUpdate(
            { _id: filter._id }, 
            { $push: { hideFromUsers: filter.userId } }, 
            { new: true }
        );

        if(influencerUpdated?.length) {
            return res.status(200).json({
                status: true,
                data: influencerUpdated
            });
        } 

        return res.status(200).json({
            status: true,
            data: []
        });
    } catch (error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const updateInfluencersInDB = async(req, res, next) => {
    const request = req;
}

export { fetchAllInfluencers, hideInfluencer, unhideInfluencer };