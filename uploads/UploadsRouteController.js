const uploadImage = async(req, res, next) => {
    const form = req.body;
    
    let updatedTask = await TasksSchema.findOneAndUpdate({ userId: form.userId, name: form.task.name }, { $set: { status: form.task.status }}, { new: true });
    console.log(updatedTask)
    if (updatedTask) {
        return res.status(200).json({
            status: true,
            message: 'Task was updated successfully!'
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

export { uploadImage };