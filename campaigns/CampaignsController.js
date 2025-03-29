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

const updateCampaign = async (req, res, next) => {
    try {
        const form = req.body;

        // Fetch the current campaign before updating
        const currentCampaign = await CampaignsSchema.findOne({ userId: form.userId, _id: form._id });

        if (!currentCampaign) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        // Extract old and new compensation values
        const oldCompensation = currentCampaign.compensation;
        const newCompensation = form.compensation;
        const isCompensationDifference = (currentCampaign.compensation != form.compensation);
        const compensationDifference = newCompensation - oldCompensation;

        // Extract old and new compensation duration values
        const oldCompensationDuration = currentCampaign.compensationDuration;
        const newCompensationDuration = form.compensationDuration;
        const isCompensationDurationDifference = (oldCompensationDuration != newCompensationDuration);

        // Extract old and new status values
        const oldStatus = currentCampaign.status;
        const newStatus = form.status;
        const isStatusDifference = (currentCampaign.status != form.status);

        const oldStartDate = new Date(currentCampaign.startDate);
        const newStartDate = new Date(form.startDate);
        const isStartDateDifference = (oldStartDate != newStartDate);

        // Determine if the campaign started in the current month
        const currentDate = new Date();
        const campaignStartDate = new Date(currentCampaign.startDate);
        const newCampaignStartDate = new Date(form.startDate);
        const isOldSameMonth = 
            campaignStartDate.getFullYear() === currentDate.getFullYear() &&
            campaignStartDate.getMonth() + 1 === currentDate.getMonth() + 1;

        const isNewSameMonth = 
            newCampaignStartDate.getFullYear() === currentDate.getFullYear() &&
            newCampaignStartDate.getMonth() + 1 === currentDate.getMonth() + 1;

        if(isStatusDifference) {
            if (newStatus === "Active" && oldStatus !== "Active") {
                if (isOldSameMonth) {
                    if (currentCampaign.compensationDuration === "One-Time Payment") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: currentCampaign.compensation, isPaid: true } });
                    } else if (currentCampaign.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: currentCampaign.compensation, thisMonthRecurringRevenue: currentCampaign.compensation, thisMonthTotalClients: 1, isPaid: true } });
                    }
                } else {
                    if (currentCampaign.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthRecurringRevenue: currentCampaign.compensation, thisMonthTotalClients: 1, isPaid: true } });
                    }
                }
            } else if (oldStatus === "Active" && newStatus !== "Active") {
                if (isOldSameMonth) {
                    if (currentCampaign.compensationDuration === "One-Time Payment") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: -currentCampaign.compensation, isPaid: false } });
                    } else if (currentCampaign.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: -currentCampaign.compensation, thisMonthRecurringRevenue: -currentCampaign.compensation, thisMonthTotalClients: -1, thisMonthRecurringClients: -1, isPaid: false } });
                    }
                } else {
                    if (currentCampaign.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthRecurringRevenue: -currentCampaign.compensation, thisMonthTotalClients: -1, isPaid: false } });
                    }
                }
            }
        } else if(newStatus == "Active") {
            if(isStartDateDifference) {
                if (isOldSameMonth && !isNewSameMonth) {
                    // Status changed to Active → ADD compensation
                    if (form.compensationDuration === "One-Time Payment") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: -currentCampaign.compensation } });
                    } else if (form.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: -currentCampaign.compensation } });
                    }
                } else if (isNewSameMonth && !isOldSameMonth) {
                    // Status changed from Active → SUBTRACT compensation
                    if (form.compensationDuration === "One-Time Payment") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: currentCampaign.compensation, isPaid: true } });
                    } else if (form.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: currentCampaign.compensation, isPaid: true } });
                    }
                }
            }

            if(isCompensationDifference) {
                if (isNewSameMonth) {
                    if (form.compensationDuration === "One-Time Payment" && currentCampaign.isPaid) {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: compensationDifference } });
                    } else if (form.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthTotalRevenue: compensationDifference, thisMonthRecurringRevenue: compensationDifference } });
                    }
                } else {
                    if (form.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthRecurringRevenue: compensationDifference } });
                    }
                }
            }

            if(isCompensationDurationDifference) {
                if (isNewSameMonth) {
                    if (form.compensationDuration === "One-Time Payment") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthRecurringRevenue: -currentCampaign.compensation, thisMonthTotalClients: -1 } });
                    } else if (form.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthRecurringRevenue: currentCampaign.compensation, thisMonthTotalClients: 1} });
                    }
                } else {
                    if (form.compensationDuration === "Per Month") {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthRecurringRevenue: currentCampaign.compensation, thisMonthTotalClients: 1} });
                    } else {
                        await UserSchema.findOneAndUpdate({_id: form.userId}, { $inc: { thisMonthRecurringRevenue: -currentCampaign.compensation, thisMonthTotalClients: -1} });
                    }
                }
            }
        }

        // Update the campaign document
        const updatedCampaign = await CampaignsSchema.findOneAndUpdate(
            { userId: form.userId, _id: form._id },
            { $set: form },
            { new: true }
        );

        if (updatedCampaign) {
            return res.status(200).json({
                status: true,
                message: "Campaign was updated successfully!",
                data: updatedCampaign,
            });
        }

        return res.status(500).json({ error: "Something went wrong" });

    } catch (error) {
        console.error("Error updating campaign:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const deleteCampaign = async(req, res, next) => {
     const form = req.query;
     const myProfile = await UserSchema.findById({_id: form.userId});

    const campaignToDelete = {
        userId: form.userId,
        _id: form.campaignId
    }

    const campaignDeleted = await CampaignsSchema.findOneAndDelete(campaignToDelete);
    
    if(campaignDeleted.status == 'Active') {
        if(campaignDeleted.compensationDuration === 'Per Month') {
            const today = new Date();
            let myNewTotalRevenue = Number(myProfile.thisMonthTotalRevenue || 0);
            let newClients = Number(myProfile.thisMonthNewClients);
            const myNewRecurringRevenue = Number(myProfile.thisMonthRecurringRevenue || 0) - Number(campaignDeleted.compensation);
            const totalClients = Number(myProfile.thisMonthTotalClients) - 1;
            const isSameMonth = 
                new Date(campaignToDelete.startDate).getFullYear() === today.getFullYear() &&
                new Date(campaignToDelete.startDate).getMonth() + 1 === today.getMonth() + 1;
    
            // Deduct from thisMonthTotalRevenue ONLY if today is before the next billing date
            if (isSameMonth) {
                myNewTotalRevenue -= Number(campaignToDelete.compensation);
                newClients -= 1;
    
                await UserSchema.findByIdAndUpdate({_id: form.userId}, 
                    { $set: { thisMonthTotalRevenue: myNewTotalRevenue, thisMonthRecurringRevenue: myNewRecurringRevenue, thisMonthNewClients: newClients, thisMonthTotalClients: totalClients}}, { new: true }
                );
    
            } else {
                await UserSchema.findByIdAndUpdate({_id: form.userId}, 
                    { $set: { thisMonthRecurringRevenue: myNewRecurringRevenue, thisMonthNewClients: newClients, thisMonthTotalClients: totalClients}}, { new: true }
                );
            }
        } else if(campaignDeleted.compensationDuration === 'One-Time Payment') {
            let totalClients = Number(myProfile.thisMonthTotalClients) - 1;
            let newClients = Number(myProfile.thisMonthNewClients);
            const campaignStartDate = new Date(campaignToDelete.startDate);
            const today = new Date();
            let myNewTotalRevenue = Number(myProfile.thisMonthTotalRevenue || 0);
    
            // Deduct from thisMonthTotalRevenue ONLY if today is before the next billing date
            if (today.getMonth() + 1 == new Date(campaignStartDate).getMonth + 1) {
                myNewTotalRevenue -= Number(campaignToDelete.compensation);
                newClients -= 1;
            }
    
            await UserSchema.findByIdAndUpdate({_id: form.userId}, 
                { $set: { thisMonthTotalRevenue: myNewTotalRevenue, thisMonthNewClients: newClients, thisMonthTotalClients: totalClients}}, { new: true }
            );
        }
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
        if(newCampaign.status == 'Active') {
            if (new Date(newCampaign.startDate).getMonth() + 1 === currentMonth && new Date(newCampaign.startDate).getFullYear() === currentYear) {
                const updateFields = { $inc: { thisMonthTotalRevenue: newCampaign.compensation } };
                updateFields.$inc.thisMonthNewClients = 1;
                updateFields.$inc.thisMonthTotalRevenue = newCampaign.compensation;
                            
                if (newCampaign.compensationDuration === 'Per Month') {
                    updateFields.$inc.thisMonthRecurringRevenue = newCampaign.compensation;
                    updateFields.$inc.thisMonthTotalClients = 1;
                }
                            
                await UserSchema.findByIdAndUpdate(form.userId, updateFields, { new: true });
                newCampaign.isPaid = true;
            } else {
                if(newCampaign.compensationDuration == 'One-Time Payment')  {
                    const updateFields = { $inc: { thisMonthNewClients: 1 } };
                    await UserSchema.findByIdAndUpdate(form.userId, updateFields, { new: true });
                    newCampaign.isPaid = false;
                } else {
                    const updateFields = { $inc: { thisMonthRecurringRevenue: newCampaign.compensation } };
                    updateFields.$inc.thisMonthNewClients = 1;
                    updateFields.$inc.thisMonthTotalClients = 1;
                    await UserSchema.findByIdAndUpdate(form.userId, updateFields, { new: true });
                    newCampaign.isPaid = true;
                }
            }
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