import InfluencersSchema from '../influencers/InfluencersSchema.js';
import UserSchema from '../users/UserSchema.js';
import CampaignsSchema from './CampaignsSchema.js';
import CampaignSchema from './CampaignsSchema.js';

const myCampaigns = async(req, res, next) => {
    try {
        const sorting = { 'firstName': -1 };
        const filter = req.query;
        const query = { $and: [] }; // Initialize $and operator as an array
        query.$and.push({ userId: filter.userId });
    
        if(filter.paymentType) {
            query.$and.push({ compensationDuration: filter.paymentType });
        }

        if(filter.status) {
            //query.$and.push({ status: filter.status }); UNCOMMENT LATER
        }
        console.log(query)
        const campaigns = 
            await CampaignSchema.find(query)
            //.sort(sorting)
            .skip((filter && filter.page) ? parseInt(filter.limit) * (parseInt(filter.page) - 1) : 0)
            .limit(parseInt(filter.limit));
    
        return res.status(200).json({
            status: true,
            data: campaigns
        });
    } catch(error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

const updateCampaign = async(req, res, next) => {
     const form = req.body;

    const updatedCampaign = await CampaignsSchema.findOneAndUpdate({ userId: form.userId, _id: form._id },
        { $set: form },
        { new: true }
    )

    if (updatedCampaign) {
        return res.status(200).json({
            status: true,
            message: 'Campaign was updated successfully!',
            data: updatedCampaign
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const deleteCampaign = async(req, res, next) => {
     const form = req.query;
        console.log(req.query)
        const campaignToDelete = {
            userId: form.userId,
            _id: form.campaignId
        }
        const campaignDeleted = await CampaignsSchema.findOneAndDelete(campaignToDelete);
        
        if(campaignDeleted) {
            return res.status(200).json({
                status: true,
                message: 'Campaign was deleted successfully!'
            });
        }
        return res.status(500).json({error: 'Something went wrong'});
      
}

const createCampaign = async(req, res, next) => {
    const form = req.body;
    const client = await InfluencersSchema.findOne({name: form.clientName.trim()});
        const newCampaign = {
            createdDate: new Date().toLocaleString(),
            userId: form.userId,
            clientName: form.clientName.trim(),
            profilePic: client.profilePic,
            compensation: form.compensation,
            compensationDuration: form.duration,
            startDate: form.startDate,
            isEndDate: form.isEndDate,
            endDate: form.endDate,
            details: form.details,
        }
        const campaignCreated = await CampaignSchema.create(newCampaign);

        if(newCampaign.compensationDuration === 'Per Month') {
            const myProfile = await UserSchema.findById({_id: newCampaign.userId});
            const myNewRecurringRevenue = Number(myProfile.recurringRevenue || 0) + Number(newCampaign.compensation);
            const myNewMonthlyRevenue = Number(myProfile.thisMonthRevenue || 0) + Number(newCampaign.compensation);
            const totalClients = Number(myProfile.totalClients) + 1;
            const newClients = Number(myProfile.newClients) + 1;
            await UserSchema.findByIdAndUpdate({_id: newCampaign.userId}, 
                { $set: { recurringRevenue: myNewRecurringRevenue, thisMonthRevenue: myNewMonthlyRevenue,
                          totalClients: totalClients, newClients: newClients}}, { new: true }
            );
        } else if(newCampaign.compensationDuration === 'One-Time Payment') {
            const myProfile = await UserSchema.findById({_id: newCampaign.userId});
            const totalClients = Number(myProfile.totalClients) + 1;
            const newClients = Number(myProfile.newClients) + 1;
            const myNewMonthlyRevenue = Number(myProfile.thisMonthRevenue || 0) + Number(newCampaign.compensation);
            await UserSchema.findByIdAndUpdate({_id: newCampaign.userId}, 
                { $set: { thisMonthRevenue: myNewMonthlyRevenue, totalClients: totalClients,
                          newClients: newClients}}, { new: true }
            );
        }
        
        if(campaignCreated) {
            return res.status(200).json({
                status: true,
                message: 'Campaign was created successfully!'
            });
        }
        return res.status(500).json({error: 'Something went wrong'});
}

export { myCampaigns, updateCampaign, deleteCampaign, createCampaign };