import InfluencersSchema from '../influencers/InfluencersSchema.js';
import UserSchema from '../users/UserSchema.js';
import CampaignsSchema from './CampaignsSchema.js';
import CampaignSchema from './CampaignsSchema.js';

const myCampaigns = async(req, res, next) => {
    try {
        const sorting = { 'startDate': -1 };
        const filter = req.query;
        const query = { $and: [] }; // Initialize $and operator as an array
        query.$and.push({ userId: filter.userId });
    
        if(filter.paymentType) {
            query.$and.push({ compensationDuration: filter.paymentType });
        }

        if(filter.status) {
            query.$and.push({ status: filter.status });
        }

        const campaigns = await CampaignSchema.find(query)
            .sort(sorting)
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
     const myProfile = await UserSchema.findById({_id: form.userId});

    const campaignToDelete = {
        userId: form.userId,
        _id: form.campaignId
    }

    const campaignDeleted = await CampaignsSchema.findOneAndDelete(campaignToDelete);
    

    if(campaignDeleted.compensationDuration === 'Per Month') {
        const campaignStartDate = new Date(campaignToDelete.startDate);
        const today = new Date();

        // Calculate next billing date
        let nextBillingDate = new Date(campaignStartDate);
        while (nextBillingDate <= today) {
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        }

        let myNewTotalRevenue = Number(myProfile.thisMonthTotalRevenue || 0);
        const myNewRecurringRevenue = Number(myProfile.thisMonthRecurringRevenue || 0) - Number(campaignDeleted.compensation);
        
        // Deduct from thisMonthTotalRevenue ONLY if today is before the next billing date
        if (today < nextBillingDate) {
            myNewTotalRevenue -= Number(campaignToDelete.compensation);
        }
        
        const totalClients = Number(myProfile.thisMonthTotalClients) - 1;
        await UserSchema.findByIdAndUpdate({_id: form.userId}, 
            { $set: { thisMonthRecurringRevenue: myNewRecurringRevenue, thisMonthTotalRevenue: myNewMonthlyRevenue,
                        thisMonthTotalClients: totalClients, thisMonthNewClients: newClients}}, { new: true }
            );

    } else if(campaignDeleted.compensationDuration === 'One-Time Payment') {
        const totalClients = Number(myProfile.totalClients) - 1;
        const campaignStartDate = new Date(campaignToDelete.startDate);
        const today = new Date();
        let myNewTotalRevenue = Number(myProfile.thisMonthTotalRevenue || 0);

        // Deduct from thisMonthTotalRevenue ONLY if today is before the next billing date
        if (today < campaignStartDate) {
            myNewTotalRevenue -= Number(campaignToDelete.compensation);
        }

        await UserSchema.findByIdAndUpdate({_id: form.userId}, 
            { $set: { thisMonthTotalRevenue: myNewTotalRevenue, thisMonthTotalClients: totalClients,}}, { new: true }
        );
    }
        
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
            profilePic: client ? client.profilePic : '',
            compensation: form.compensation,
            compensationDuration: form.compensationDuration,
            startDate: form.startDate,
            isEndDate: form.isEndDate,  
            endDate: form.endDate,
            details: form.details,
            status: form.status
        }

        const date = new Date();
        const currentMonth = date.getMonth() + 1;
        const currentYear = date.getFullYear();
        if (new Date(newCampaign.startDate).getMonth() + 1 === currentMonth && new Date(newCampaign.startDate).getFullYear() === currentYear) {
            const updateFields = { $inc: { thisMonthTotalRevenue: newCampaign.compensation } };
            updateFields.$inc.thisMonthNewClients = 1;
            updateFields.$inc.thisMonthTotalClients = 1;
            updateFields.$inc.thisMonthRecurringRevenue = newCampaign.compensation;
                        
            if (newCampaign.compensationDuration === 'Per Month') {
                updateFields.$inc.thisMonthRecurringRevenue = newCampaign.compensation;
            }
                        
            await UserSchema.findByIdAndUpdate(form.userId, updateFields, { new: true });
            newCampaign.isPaid = true;
        } else {
            const updateFields = { $inc: { thisMonthRecurringRevenue: newCampaign.compensation } };
            updateFields.$inc.thisMonthNewClients = 1;
            updateFields.$inc.thisMonthTotalClients = 1;
            await UserSchema.findByIdAndUpdate(form.userId, updateFields, { new: true });
            newCampaign.isPaid = newCampaign.compensationDuration == 'One-Time Payment' ? false : true;
        }
        
        const campaignCreated = await CampaignSchema.create(newCampaign);
        if(campaignCreated) {
            return res.status(200).json({
                status: true,
                message: 'Campaign was created successfully!'
            });
        }
        return res.status(500).json({error: 'Something went wrong'});
}

export { myCampaigns, updateCampaign, deleteCampaign, createCampaign };