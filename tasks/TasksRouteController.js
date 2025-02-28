import config from '../config/config.js';
import TasksSchema from './TasksSchema.js';

const createNewTask = async(req, res, next) => {
    const form = req.body;
    console.log(form)
    const newTask = {
        createdDate: new Date().toLocaleString(),
        userId: form.userId,
        title: form.name.trim(),
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate,
        recurring: form.recurring === 'Yes' ? true : false,
        reminder: form.reminder,
        dueDateTime: form.time,
        flagged: form.flagged,
        status: form.status
    }
    console.log(newTask)
    const taskCreated = await TasksSchema.create(newTask);
    
    if(taskCreated) {
        return res.status(200).json({
            status: true,
            message: 'Task was created successfully!'
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const updateTask = async(req, res, next) => {
    console.log('updating task!!!!')
    const form = req.body;
    
    let updatedTask = await TasksSchema.findOneAndUpdate({ userId: form.userId, _id: form._id }, { $set: form }, { new: true });
    console.log(updatedTask)
    if (updatedTask) {
        return res.status(200).json({
            status: true,
            message: 'Task was updated successfully!'
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const editTask = async(req, res, next) => {
    const form = req.body;
    
    let updatedTask = await TasksSchema.findOneAndUpdate({ userId: form.userId, name: form.task.name }, { $set: { status: form.task.status }}, { new: true });
    console.log(updatedTask)

    if (updatedTask) {
        return res.status(200).json({
            status: true,
            message: 'Task was edited successfully!'
        });
    }
    return res.status(500).json({error: 'Something went wrong'});
}

const deleteTask = async(req, res, next) => {
     const form = req.query;
     const taskToDelete = {
        userId: form.userId,
        _id: form.taskId
     }
     const taskDeleted = await TasksSchema.findOneAndDelete(taskToDelete);
    
     if(taskDeleted) {
        return res.status(200).json({
            status: true,
            message: 'Task was deleted successfully!'
        });
     }
     return res.status(500).json({error: 'Something went wrong'});
}

const getMyTasks = async(req, res, next) => {
    const form = req.query;
    try {
        const tasks = await TasksSchema.find({userId: form.userId}).sort({createdDate: -1});

        return res.status(200).json({
            status: true,
            data: tasks
        });
    } catch(error) {
        return res.status(500).json({error: 'Something went wrong'});
    }
}

export { createNewTask, getMyTasks, deleteTask, updateTask, editTask };